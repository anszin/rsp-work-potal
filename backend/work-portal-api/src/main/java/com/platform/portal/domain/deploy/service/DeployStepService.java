package com.platform.portal.domain.deploy.service;

import com.platform.portal.domain.deploy.dto.DeployStepDto;
import com.platform.portal.domain.deploy.entity.DeployRequest;
import com.platform.portal.domain.deploy.entity.DeployStep;
import com.platform.portal.domain.deploy.repository.DeployRequestRepository;
import com.platform.portal.domain.deploy.repository.DeployStepRepository;
import com.platform.portal.domain.system.repository.SystemManagerRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import com.platform.portal.service.WebexService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeployStepService {

    private final DeployStepRepository stepRepository;
    private final DeployRequestRepository deployRequestRepository;
    private final SystemManagerRepository systemManagerRepository;
    private final UserRepository userRepository;
    private final WebexService webexService;

    public List<DeployStepDto.Response> findByDeployRequestId(Long deployRequestId) {
        return stepRepository.findByDeployRequestIdOrderByStepOrder(deployRequestId)
                .stream().map(DeployStepDto.Response::new).toList();
    }

    @Transactional
    public DeployStepDto.CompleteResult complete(Long stepId, String username) {
        DeployStep step = stepRepository.findById(stepId)
                .orElseThrow(() -> new IllegalArgumentException("Step not found: " + stepId));
        DeployRequest dr = step.getDeployRequest();
        checkCompletePermission(dr, username);

        if (step.getStatus() == DeployStep.StepStatus.DONE) {
            throw new IllegalStateException("이미 완료된 단계입니다.");
        }

        step.setStatus(DeployStep.StepStatus.DONE);
        step.setCompletedBy(username);
        step.setCompletedAt(LocalDateTime.now());

        long total = stepRepository.countByDeployRequestId(dr.getId());
        long done = stepRepository.countByDeployRequestIdAndStatus(dr.getId(), DeployStep.StepStatus.DONE);

        webexService.notifyStepCompleted(dr, step.getServerName(), (int) done, (int) total, username);

        boolean allDone = done == total;
        if (allDone) {
            dr.setStatus(DeployRequest.Status.COMPLETED);
            dr.setDeployedAt(LocalDateTime.now());
            deployRequestRepository.save(dr);
            webexService.notifyAllStepsCompleted(dr, username);
        }

        return new DeployStepDto.CompleteResult(new DeployStepDto.Response(step), allDone);
    }

    /**
     * 단계 완료 권한 (F-AUTH-001 R-004, L1 ④): 해당 시스템 담당자(MEMBER) 또는 ADMIN/MANAGER.
     * EXTERNAL 은 담당자로 등록돼 있어도 불가.
     */
    private void checkCompletePermission(DeployRequest dr, String username) {
        User actor = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));
        boolean isAdminOrManager = actor.getRole() == User.Role.ADMIN || actor.getRole() == User.Role.MANAGER;
        boolean isMemberWithAccess = actor.getRole() == User.Role.MEMBER
                && systemManagerRepository.existsBySystemIdAndUserId(dr.getSystem().getId(), actor.getId());
        if (!isAdminOrManager && !isMemberWithAccess) {
            throw new AccessDeniedException("해당 시스템의 담당자만 단계를 완료할 수 있습니다.");
        }
    }
}
