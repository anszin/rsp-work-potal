package com.platform.portal.domain.deploy.repository;

import com.platform.portal.domain.deploy.entity.DeployStep;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeployStepRepository extends JpaRepository<DeployStep, Long> {
    List<DeployStep> findByDeployRequestIdOrderByStepOrder(Long deployRequestId);
    long countByDeployRequestId(Long deployRequestId);
    long countByDeployRequestIdAndStatus(Long deployRequestId, DeployStep.StepStatus status);
    void deleteByDeployRequestId(Long deployRequestId);
}
