package com.platform.portal.domain.request.service;

import com.platform.portal.domain.request.dto.ChangeRequestDto;
import com.platform.portal.domain.request.entity.ChangeRequest;
import com.platform.portal.domain.request.entity.ChangeRequest.Status;
import com.platform.portal.domain.request.repository.ChangeRequestRepository;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
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
public class ChangeRequestService {

    private final ChangeRequestRepository changeRequestRepository;
    private final OperationSystemRepository systemRepository;
    private final UserRepository userRepository;

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
        cr.setTitle(req.getTitle());
        cr.setContent(req.getContent());
        cr.setTargetDate(req.getTargetDate());
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
        cr.setTargetDate(req.getTargetDate());
        return new ChangeRequestDto.Response(cr);
    }

    @Transactional
    public ChangeRequestDto.Response changeStatus(Long id, Status newStatus) {
        ChangeRequest cr = getOrThrow(id);
        Status current = cr.getStatus();

        if (!ALLOWED_TRANSITIONS.getOrDefault(current, Set.of()).contains(newStatus)) {
            throw new IllegalStateException(
                    String.format("%s → %s 전환 불가", current, newStatus));
        }

        cr.setStatus(newStatus);
        switch (newStatus) {
            case REQUESTED -> cr.setRequestedAt(LocalDateTime.now());
            case APPROVED  -> cr.setApprovedAt(LocalDateTime.now());
            case COMPLETED -> cr.setCompletedAt(LocalDateTime.now());
            default -> {}
        }
        return new ChangeRequestDto.Response(cr);
    }

    @Transactional
    public void delete(Long id) {
        ChangeRequest cr = getOrThrow(id);
        if (cr.getStatus() != Status.DRAFT) {
            throw new IllegalStateException("DRAFT 상태에서만 삭제 가능합니다.");
        }
        changeRequestRepository.deleteById(id);
    }

    private ChangeRequest getOrThrow(Long id) {
        return changeRequestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("ChangeRequest not found: " + id));
    }
}
