package com.platform.portal.domain.request.service;

import com.platform.portal.domain.request.dto.ChangeRequestDto;
import com.platform.portal.domain.request.entity.ChangeRequest;
import com.platform.portal.domain.request.entity.ChangeRequest.Status;
import com.platform.portal.domain.request.entity.ChangeRequestIssue;
import com.platform.portal.domain.request.repository.ChangeRequestRepository;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.system.repository.SubSystemRepository;
import com.platform.portal.domain.system.repository.SystemManagerRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import com.platform.portal.service.FileStorageService;
import com.platform.portal.service.RedmineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChangeRequestService {

    private final ChangeRequestRepository changeRequestRepository;
    private final OperationSystemRepository systemRepository;
    private final SubSystemRepository subSystemRepository;
    private final UserRepository userRepository;
    private final SystemManagerRepository systemManagerRepository;
    private final FileStorageService fileStorageService;
    private final RedmineService redmineService;

    @Value("${redmine.cr-tracker-id:#{null}}")
    private Integer crTrackerId;

    private static final Map<Status, Set<Status>> ALLOWED_TRANSITIONS = Map.of(
            Status.DRAFT,     Set.of(Status.REQUESTED),
            Status.REQUESTED, Set.of(Status.APPROVED, Status.REJECTED),
            Status.APPROVED,  Set.of(Status.COMPLETED)
    );

    public List<ChangeRequestDto.Response> findAll() {
        return changeRequestRepository.findAllWithDetails().stream()
                .map(ChangeRequestDto.Response::new).toList();
    }

    public List<ChangeRequestDto.Response> findBySystemId(Long systemId) {
        return changeRequestRepository.findBySystemId(systemId).stream()
                .map(ChangeRequestDto.Response::new).toList();
    }

    public List<ChangeRequestDto.Response> findByStatus(Status status) {
        return changeRequestRepository.findByStatus(status).stream()
                .map(ChangeRequestDto.Response::new).toList();
    }

    public ChangeRequestDto.Response findById(Long id) {
        return changeRequestRepository.findById(id)
                .map(ChangeRequestDto.Response::new)
                .orElseThrow(() -> new IllegalArgumentException("ChangeRequest not found: " + id));
    }

    @Transactional
    public ChangeRequestDto.Response create(ChangeRequestDto.CreateRequest req, String username) {
        ChangeRequest cr = new ChangeRequest();
        cr.setSystem(systemRepository.findById(req.getSystemId())
                .orElseThrow(() -> new IllegalArgumentException("System not found")));
        if (req.getSubSystemId() != null) {
            cr.setSubSystem(subSystemRepository.findById(req.getSubSystemId())
                    .orElseThrow(() -> new IllegalArgumentException("SubSystem not found")));
        }
        cr.setRequester(userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found")));
        cr.setRequestNo(generateRequestNo());
        cr.setTitle(req.getTitle());
        cr.setContent(req.getContent());
        cr.setRequesterDept(req.getRequesterDept());
        cr.setRequesterName(req.getRequesterName());
        cr.setTargetDate(req.getTargetDate());
        cr.setAttachmentLink(req.getAttachmentLink());
        cr.setRedmineTrackerId(req.getRedmineTrackerId());
        ChangeRequest saved = changeRequestRepository.save(cr);
        byte[] fileBytes = req.decodeAttachment();
        if (fileBytes != null && req.getAttachmentFilename() != null) {
            try {
                String stored = fileStorageService.store(fileBytes, req.getAttachmentFilename(), saved.getId());
                saved.setAttachmentPath(stored);
                saved.setAttachmentOriginalName(req.getAttachmentFilename());
            } catch (IOException e) { throw new RuntimeException("파일 저장 실패: " + e.getMessage(), e); }
        }
        createRedmineIssueIfPossible(saved, req.getRedmineTrackerId());
        return new ChangeRequestDto.Response(saved);
    }

    @Transactional
    public ChangeRequestDto.Response syncRedmine(Long id) {
        ChangeRequest cr = getOrThrow(id);
        createRedmineIssueIfPossible(cr, cr.getRedmineTrackerId());
        return new ChangeRequestDto.Response(cr);
    }

    private void createRedmineIssueIfPossible(ChangeRequest cr, Integer trackerId) {
        String projectKey = cr.getSystem().getRedmineProjectKey();
        if (projectKey == null || projectKey.isBlank()) {
            cr.setRedmineSyncStatus(ChangeRequest.RedmineSyncStatus.SKIPPED);
            return;
        }
        Integer resolvedTrackerId = trackerId != null ? trackerId : crTrackerId;
        String subject = cr.getSubSystem() != null
                ? "[" + cr.getSubSystem().getName() + "] " + cr.getTitle()
                : cr.getTitle();
        try {
            Integer issueId = redmineService.createIssue(projectKey, subject, cr.getContent(), resolvedTrackerId);
            if (issueId != null) {
                cr.getRedmineIssues().add(new ChangeRequestIssue(cr, issueId, subject));
            }
            cr.setRedmineSyncStatus(ChangeRequest.RedmineSyncStatus.SYNCED);
        } catch (Exception e) {
            log.warn("Redmine issue creation failed for CR {}: {}", cr.getRequestNo(), e.getMessage());
            cr.setRedmineSyncStatus(ChangeRequest.RedmineSyncStatus.FAILED);
        }
    }

    @Transactional
    public ChangeRequestDto.Response update(Long id, ChangeRequestDto.UpdateRequest req) {
        ChangeRequest cr = getOrThrow(id);
        if (cr.getStatus() != Status.DRAFT) {
            throw new IllegalStateException("DRAFT 상태에서만 수정 가능합니다.");
        }
        cr.setSystem(systemRepository.findById(req.getSystemId())
                .orElseThrow(() -> new IllegalArgumentException("System not found")));
        cr.setSubSystem(req.getSubSystemId() != null
                ? subSystemRepository.findById(req.getSubSystemId()).orElseThrow(() -> new IllegalArgumentException("SubSystem not found"))
                : null);
        cr.setTitle(req.getTitle());
        cr.setContent(req.getContent());
        cr.setRequesterDept(req.getRequesterDept());
        cr.setRequesterName(req.getRequesterName());
        cr.setTargetDate(req.getTargetDate());
        cr.setAttachmentLink(req.getAttachmentLink());
        byte[] fileBytes = req.decodeAttachment();
        if (fileBytes != null && req.getAttachmentFilename() != null) {
            try {
                if (cr.getAttachmentPath() != null) fileStorageService.delete(cr.getAttachmentPath());
                String stored = fileStorageService.store(fileBytes, req.getAttachmentFilename(), id);
                cr.setAttachmentPath(stored);
                cr.setAttachmentOriginalName(req.getAttachmentFilename());
            } catch (IOException e) { throw new RuntimeException("파일 저장 실패: " + e.getMessage(), e); }
        }
        return new ChangeRequestDto.Response(cr);
    }

    @Transactional
    public ChangeRequestDto.Response changeStatus(Long id, ChangeRequestDto.StatusRequest req, String username) {
        ChangeRequest cr = getOrThrow(id);
        Status current = cr.getStatus();
        Status newStatus = req.getStatus();

        if (!ALLOWED_TRANSITIONS.getOrDefault(current, Set.of()).contains(newStatus)) {
            throw new IllegalStateException(
                    String.format("%s → %s 전환 불가", current, newStatus));
        }

        // REQUESTED(제출)는 요청자 본인만 가능, APPROVED/REJECTED/COMPLETED는 ADMIN 또는 시스템 담당자만 가능
        if (newStatus == Status.REQUESTED) {
            if (!cr.getRequester().getUsername().equals(username)) {
                throw new AccessDeniedException("본인의 요청만 제출할 수 있습니다.");
            }
        } else {
            User actor = userRepository.findByUsername(username)
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));
            boolean isAdminOrManager = actor.getRole() == User.Role.ADMIN || actor.getRole() == User.Role.MANAGER;
            boolean isMemberWithAccess = actor.getRole() == User.Role.MEMBER &&
                    systemManagerRepository.existsBySystemIdAndUserId(cr.getSystem().getId(), actor.getId());
            if (!isAdminOrManager && !isMemberWithAccess) {
                throw new AccessDeniedException("처리 권한이 없습니다.");
            }
        }

        cr.setStatus(newStatus);
        cr.setActionComment(req.getComment());
        switch (newStatus) {
            case REQUESTED -> cr.setRequestedAt(LocalDateTime.now());
            case APPROVED  -> cr.setApprovedAt(LocalDateTime.now());
            case COMPLETED -> cr.setCompletedAt(LocalDateTime.now());
            case REJECTED  -> {
                String reason = req.getRejectionReason() != null ? req.getRejectionReason() : req.getComment();
                cr.setRejectionReason(reason);
            }
            default -> {}
        }
        return new ChangeRequestDto.Response(cr);
    }

    @Transactional
    public ChangeRequestDto.Response uploadAttachment(Long id, ChangeRequestDto.FileUploadRequest req) {
        ChangeRequest cr = getOrThrow(id);
        try {
            if (cr.getAttachmentPath() != null) fileStorageService.delete(cr.getAttachmentPath());
            String stored = fileStorageService.store(req.decode(), req.getFilename(), id);
            cr.setAttachmentPath(stored);
            cr.setAttachmentOriginalName(req.getFilename());
        } catch (IOException e) {
            throw new RuntimeException("파일 업로드 실패", e);
        }
        return new ChangeRequestDto.Response(cr);
    }

    @Transactional
    public void deleteAttachment(Long id) {
        ChangeRequest cr = getOrThrow(id);
        try {
            fileStorageService.delete(cr.getAttachmentPath());
            cr.setAttachmentPath(null);
            cr.setAttachmentOriginalName(null);
        } catch (IOException e) {
            throw new RuntimeException("파일 삭제 실패", e);
        }
    }

    @Transactional
    public void delete(Long id, String username) {
        ChangeRequest cr = getOrThrow(id);
        User actor = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));
        boolean isAdminOrManager = actor.getRole() == User.Role.ADMIN || actor.getRole() == User.Role.MANAGER;
        if (!isAdminOrManager && cr.getStatus() != Status.DRAFT) {
            throw new IllegalStateException("DRAFT 상태에서만 삭제 가능합니다.");
        }
        try { fileStorageService.delete(cr.getAttachmentPath()); } catch (IOException ignored) {}
        changeRequestRepository.deleteById(id);
    }

    private String generateRequestNo() {
        int year = LocalDate.now().getYear();
        LocalDateTime start = LocalDate.of(year, 1, 1).atStartOfDay();
        LocalDateTime end = LocalDate.of(year + 1, 1, 1).atStartOfDay();
        long count = changeRequestRepository.countByYear(start, end);
        return String.format("CR-%d-%03d", year, count + 1);
    }

    private ChangeRequest getOrThrow(Long id) {
        return changeRequestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("ChangeRequest not found: " + id));
    }
}
