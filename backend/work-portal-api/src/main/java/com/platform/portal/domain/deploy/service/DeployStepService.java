package com.platform.portal.domain.deploy.service;

import com.platform.portal.domain.deploy.dto.DeployStepDto;
import com.platform.portal.domain.deploy.entity.DeployRequest;
import com.platform.portal.domain.deploy.entity.DeployStep;
import com.platform.portal.domain.deploy.repository.DeployRequestRepository;
import com.platform.portal.domain.deploy.repository.DeployStepRepository;
import com.platform.portal.service.WebexService;
import lombok.RequiredArgsConstructor;
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
    private final WebexService webexService;

    public List<DeployStepDto.Response> findByDeployRequestId(Long deployRequestId) {
        return stepRepository.findByDeployRequestIdOrderByStepOrder(deployRequestId)
                .stream().map(DeployStepDto.Response::new).toList();
    }

    @Transactional
    public DeployStepDto.CompleteResult complete(Long stepId, String username) {
        DeployStep step = stepRepository.findById(stepId)
                .orElseThrow(() -> new IllegalArgumentException("Step not found: " + stepId));
        if (step.getStatus() == DeployStep.StepStatus.DONE) {
            throw new IllegalStateException("이미 완료된 단계입니다.");
        }

        step.setStatus(DeployStep.StepStatus.DONE);
        step.setCompletedBy(username);
        step.setCompletedAt(LocalDateTime.now());

        DeployRequest dr = step.getDeployRequest();
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
}
