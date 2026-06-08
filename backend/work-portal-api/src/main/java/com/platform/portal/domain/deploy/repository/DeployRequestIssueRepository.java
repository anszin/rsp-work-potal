package com.platform.portal.domain.deploy.repository;

import com.platform.portal.domain.deploy.entity.DeployRequestIssue;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeployRequestIssueRepository extends JpaRepository<DeployRequestIssue, Long> {
}
