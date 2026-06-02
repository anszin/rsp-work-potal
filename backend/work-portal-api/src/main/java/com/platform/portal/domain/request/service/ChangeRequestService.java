package com.platform.portal.domain.request.service;

import com.platform.portal.domain.request.dto.ChangeRequestDto;
import com.platform.portal.domain.request.entity.ChangeRequest;
import com.platform.portal.domain.request.entity.ChangeRequest.Status;
import com.platform.portal.domain.request.repository.ChangeRequestRepository;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.system.repository.SystemManagerRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import com.platform.portal.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChangeRequestService {

    private final ChangeRequestRepository changeRequestRepository;
    private final OperationSystemRepository systemRepository;
    private final UserRepository userRepository;
    private final SystemManagerRepository systemManagerRepository;
    private final FileStorageService fileStorageService;

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
        cr.setRequester(userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found")));
        cr.setRequestNo(generateRequestNo());
        cr.setTitle(req.getTitle());
        cr.setContent(req.getContent());
        cr.setRequesterDept(req.getRequesterDept());
        cr.setRequesterName(req.getRequesterName());
        cr.setTargetDate(req.getTargetDate());
        cr.setAttachmentLink(req.getAttachmentLink());
        return new ChangeRequestDto.Response(changeRequestRepository.save(cr));
    }

    @Transactional
    public ChangeRequestDto.Response update(Long id, ChangeRequestDto.UpdateRequest req) {
        ChangeRequest cr = getOrThrow(id);
        if (cr.getStatus() != Status.DRAFT) {
            throw new IllegalStateException("DRAFT 상태에서만 수정 가능합니다.");
        }
        cr.setSystem(systemRepository.findById(req.getSystemId())
                .orElseThrow(() -> new IllegalArgumentException("System not found")));
        cr.setTitle(req.getTitle());
        cr.setContent(req.getContent());
        cr.setRequesterDept(req.getRequesterDept());
        cr.setRequesterName(req.getRequesterName());
        cr.setTargetDate(req.getTargetDate());
        cr.setAttachmentLink(req.getAttachmentLink());
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
            boolean isAdmin = actor.getRole() == User.Role.ADMIN;
            boolean isManager = systemManagerRepository.existsBySystemIdAndUserId(
                    cr.getSystem().getId(), actor.getId());
            if (!isAdmin && !isManager) {
                throw new AccessDeniedException("해당 시스템의 담당자 또는 관리자만 처리할 수 있습니다.");
            }
        }

        cr.setStatus(newStatus);
        switch (newStatus) {
            case REQUESTED -> cr.setRequestedAt(LocalDateTime.now());
            case APPROVED  -> cr.setApprovedAt(LocalDateTime.now());
            case COMPLETED -> cr.setCompletedAt(LocalDateTime.now());
            case REJECTED  -> cr.setRejectionReason(req.getRejectionReason());
            default -> {}
        }
        return new ChangeRequestDto.Response(cr);
    }

    @Transactional
    public ChangeRequestDto.Response uploadAttachment(Long id, MultipartFile file) {
        ChangeRequest cr = getOrThrow(id);
        try {
            if (cr.getAttachmentPath() != null) fileStorageService.delete(cr.getAttachmentPath());
            String stored = fileStorageService.store(file, id);
            cr.setAttachmentPath(stored);
            cr.setAttachmentOriginalName(file.getOriginalFilename());
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
    public void delete(Long id) {
        ChangeRequest cr = getOrThrow(id);
        if (cr.getStatus() != Status.DRAFT) {
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
