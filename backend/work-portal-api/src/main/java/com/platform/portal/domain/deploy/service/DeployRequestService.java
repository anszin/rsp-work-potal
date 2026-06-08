package com.platform.portal.domain.deploy.service;

import com.platform.portal.domain.deploy.dto.DeployRequestDto;
import com.platform.portal.domain.deploy.entity.DeployRequest;
import com.platform.portal.domain.deploy.entity.DeployRequest.Status;
import com.platform.portal.domain.deploy.repository.DeployRequestRepository;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.system.repository.SubSystemRepository;
import com.platform.portal.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeployRequestService {

    private final DeployRequestRepository deployRequestRepository;
    private final OperationSystemRepository systemRepository;
    private final SubSystemRepository subSystemRepository;
    private final UserRepository userRepository;

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
        return deployRequestRepository.findById(id)
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
        dr.setTitle(req.getTitle());
        dr.setVersion(req.getVersion());
        dr.setDeployType(req.getDeployType());
        dr.setContent(req.getContent());
        dr.setScheduledAt(req.getScheduledAt());
        return new DeployRequestDto.Response(deployRequestRepository.save(dr));
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
        dr.setContent(req.getContent());
        dr.setScheduledAt(req.getScheduledAt());
        return new DeployRequestDto.Response(dr);
    }

    @Transactional
    public DeployRequestDto.Response changeStatus(Long id, Status newStatus, String approverUsername) {
        DeployRequest dr = getOrThrow(id);
        Status current = dr.getStatus();

        if (!ALLOWED_TRANSITIONS.getOrDefault(current, Set.of()).contains(newStatus)) {
            throw new IllegalStateException(
                    String.format("%s → %s 전환 불가", current, newStatus));
        }

        dr.setStatus(newStatus);
        switch (newStatus) {
            case REQUESTED -> { dr.setApprover(null); dr.setRequestedAt(LocalDateTime.now()); }
            case APPROVED -> {
                dr.setApprover(userRepository.findByUsername(approverUsername).orElse(null));
                dr.setApprovedAt(LocalDateTime.now());
            }
            case COMPLETED -> dr.setDeployedAt(LocalDateTime.now());
            default -> {}
        }
        return new DeployRequestDto.Response(dr);
    }

    @Transactional
    public void delete(Long id) {
        DeployRequest dr = getOrThrow(id);
        if (dr.getStatus() != Status.DRAFT) {
            throw new IllegalStateException("DRAFT 상태에서만 삭제 가능합니다.");
        }
        deployRequestRepository.deleteById(id);
    }

    private DeployRequest getOrThrow(Long id) {
        return deployRequestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("DeployRequest not found: " + id));
    }
}
