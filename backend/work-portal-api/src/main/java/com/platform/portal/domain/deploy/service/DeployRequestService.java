package com.platform.portal.domain.deploy.service;

import com.platform.portal.domain.deploy.dto.DeployRequestDto;
import com.platform.portal.domain.deploy.entity.DeployRequest;
import com.platform.portal.domain.deploy.entity.DeployRequest.Status;
import com.platform.portal.domain.deploy.entity.DeployRequestIssue;
import com.platform.portal.domain.deploy.repository.DeployRequestRepository;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.system.repository.SubSystemRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import com.platform.portal.service.RedmineService;
import com.platform.portal.service.WebexService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeployRequestService {

    private final DeployRequestRepository deployRequestRepository;
    private final OperationSystemRepository systemRepository;
    private final SubSystemRepository subSystemRepository;
    private final UserRepository userRepository;
    private final RedmineService redmineService;
    private final WebexService webexService;

    private static final Map<Status, Set<Status>> ALLOWED_TRANSITIONS = Map.of(
            Status.DRAFT,     Set.of(Status.REQUESTED),
            Status.REQUESTED, Set.of(Status.APPROVED, Status.REJECTED),
            Status.APPROVED,  Set.of(Status.COMPLETED)
    );

    public List<DeployRequestDto.Response> findAll() {
        return deployRequestRepository.findAllWithDetails().stream()
                .map(DeployRequestDto.Response::new).toList();
    }

    public List<DeployRequestDto.Response> findBySystemId(Long systemId) {
        return deployRequestRepository.findBySystemId(systemId).stream()
                .map(DeployRequestDto.Response::new).toList();
    }

    public DeployRequestDto.Response findById(Long id) {
        return deployRequestRepository.findWithIssues(id)
                .map(DeployRequestDto.Response::new)
                .orElseThrow(() -> new IllegalArgumentException("DeployRequest not found: " + id));
    }

    @Transactional
    public DeployRequestDto.Response create(DeployRequestDto.CreateRequest req, String username) {
        DeployRequest dr = new DeployRequest();
        dr.setSystem(systemRepository.findById(req.getSystemId())
                .orElseThrow(() -> new IllegalArgumentException("System not found")));
        if (req.getSubSystemId() != null) {
            dr.setSubSystem(subSystemRepository.findById(req.getSubSystemId())
                    .orElseThrow(() -> new IllegalArgumentException("SubSystem not found")));
        }
        dr.setRequester(userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found")));
        dr.setDeployNo(generateDeployNo());
        dr.setTitle(req.getTitle());
        dr.setVersion(req.getVersion());
        dr.setDeployType(req.getDeployType());
        dr.setDeployScope(req.getDeployScope());
        dr.setDeployTarget(req.getDeployScope() == DeployRequest.DeployScope.PARTIAL ? req.getDeployTarget() : null);
        dr.setContent(req.getContent());
        dr.setScheduledAt(req.getScheduledAt());
        if (req.getRedmineIssues() != null) {
            req.getRedmineIssues().forEach(ref ->
                dr.getRedmineIssues().add(new DeployRequestIssue(dr, ref.getRedmineIssueId(), ref.getRedmineIssueTitle())));
        }
        DeployRequest saved = deployRequestRepository.save(dr);
        webexService.notifyCreated(saved);
        return new DeployRequestDto.Response(saved);
    }

    @Transactional
    public DeployRequestDto.Response update(Long id, DeployRequestDto.UpdateRequest req) {
        DeployRequest dr = getOrThrow(id);
        if (dr.getStatus() != Status.DRAFT) {
            throw new IllegalStateException("DRAFT 상태에서만 수정 가능합니다.");
        }
        dr.setSystem(systemRepository.findById(req.getSystemId())
                .orElseThrow(() -> new IllegalArgumentException("System not found")));
        dr.setSubSystem(req.getSubSystemId() != null
                ? subSystemRepository.findById(req.getSubSystemId()).orElseThrow(() -> new IllegalArgumentException("SubSystem not found"))
                : null);
        dr.setTitle(req.getTitle());
        dr.setVersion(req.getVersion());
        dr.setDeployType(req.getDeployType());
        dr.setDeployScope(req.getDeployScope());
        dr.setDeployTarget(req.getDeployScope() == DeployRequest.DeployScope.PARTIAL ? req.getDeployTarget() : null);
        dr.setContent(req.getContent());
        dr.setScheduledAt(req.getScheduledAt());
        dr.getRedmineIssues().clear();
        if (req.getRedmineIssues() != null) {
            req.getRedmineIssues().forEach(ref ->
                dr.getRedmineIssues().add(new DeployRequestIssue(dr, ref.getRedmineIssueId(), ref.getRedmineIssueTitle())));
        }
        return new DeployRequestDto.Response(dr);
    }

    @Transactional
    public DeployRequestDto.Response changeStatus(Long id, DeployRequestDto.StatusRequest req, String approverUsername) {
        DeployRequest dr = getOrThrow(id);
        Status newStatus = req.getStatus();
        Status current = dr.getStatus();

        if (!ALLOWED_TRANSITIONS.getOrDefault(current, Set.of()).contains(newStatus)) {
            throw new IllegalStateException(
                    String.format("%s → %s 전환 불가", current, newStatus));
        }

        dr.setStatus(newStatus);
        dr.setActionComment(req.getComment());
        switch (newStatus) {
            case REQUESTED -> { dr.setApprover(null); dr.setRequestedAt(LocalDateTime.now()); }
            case APPROVED -> {
                dr.setApprover(userRepository.findByUsername(approverUsername).orElse(null));
                dr.setApprovedAt(LocalDateTime.now());
                createRedmineVersionIfPossible(dr);
            }
            case COMPLETED -> dr.setDeployedAt(LocalDateTime.now());
            case REJECTED  -> dr.setRejectionReason(req.getComment());
            default -> {}
        }
        webexService.notifyStatusChanged(dr, approverUsername, req.getComment());
        return new DeployRequestDto.Response(dr);
    }

    @Transactional
    public void delete(Long id, String username) {
        DeployRequest dr = getOrThrow(id);
        User actor = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));
        boolean isAdminOrManager = actor.getRole() == User.Role.ADMIN || actor.getRole() == User.Role.MANAGER;
        if (!isAdminOrManager && dr.getStatus() != Status.DRAFT) {
            throw new IllegalStateException("DRAFT 상태에서만 삭제 가능합니다.");
        }
        deployRequestRepository.deleteById(id);
    }

    @Transactional
    public DeployRequestDto.Response syncRedmine(Long id) {
        DeployRequest dr = deployRequestRepository.findWithIssues(id)
                .orElseThrow(() -> new IllegalArgumentException("DeployRequest not found: " + id));
        if (dr.getStatus() != Status.APPROVED && dr.getStatus() != Status.COMPLETED) {
            throw new IllegalStateException("승인된 배포 요청만 재동기화할 수 있습니다.");
        }
        createRedmineVersionIfPossible(dr);
        return new DeployRequestDto.Response(dr);
    }

    private void createRedmineVersionIfPossible(DeployRequest dr) {
        String projectKey = dr.getSystem().getRedmineProjectKey();
        String version = dr.getVersion();
        if (projectKey == null || projectKey.isBlank() || version == null || version.isBlank()) {
            log.info("Redmine version creation skipped: no projectKey or version field");
            dr.setRedmineSyncStatus(DeployRequest.RedmineSyncStatus.SKIPPED);
            return;
        }
        String versionName = dr.getSubSystem() != null
                ? dr.getSubSystem().getName() + "_" + version
                : version;
        try {
            Integer versionId = redmineService.createVersion(projectKey, versionName, dr.getContent());
            if (versionId != null) {
                for (DeployRequestIssue issue : dr.getRedmineIssues()) {
                    try {
                        redmineService.updateIssueFixedVersion(issue.getRedmineIssueId(), versionId);
                    } catch (Exception e) {
                        log.warn("Failed to set fixed_version on issue #{}: {}", issue.getRedmineIssueId(), e.getMessage());
                    }
                }
            }
            dr.setRedmineSyncStatus(DeployRequest.RedmineSyncStatus.SYNCED);
        } catch (Exception e) {
            log.warn("Redmine sync failed: {}", e.getMessage());
            dr.setRedmineSyncStatus(DeployRequest.RedmineSyncStatus.FAILED);
        }
    }

    private String generateDeployNo() {
        int year = LocalDate.now().getYear();
        LocalDateTime start = LocalDate.of(year, 1, 1).atStartOfDay();
        LocalDateTime end = LocalDate.of(year + 1, 1, 1).atStartOfDay();
        long count = deployRequestRepository.countByYear(start, end);
        return String.format("DR-%d-%03d", year, count + 1);
    }

    private DeployRequest getOrThrow(Long id) {
        return deployRequestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("DeployRequest not found: " + id));
    }
}
