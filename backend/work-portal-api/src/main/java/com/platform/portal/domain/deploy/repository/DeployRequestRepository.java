package com.platform.portal.domain.deploy.repository;

import com.platform.portal.domain.deploy.entity.DeployRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface DeployRequestRepository extends JpaRepository<DeployRequest, Long> {

    @Query("SELECT DISTINCT d FROM DeployRequest d JOIN FETCH d.system JOIN FETCH d.requester LEFT JOIN FETCH d.redmineIssues ORDER BY d.createdAt DESC")
    List<DeployRequest> findAllWithDetails();

    @Query("SELECT DISTINCT d FROM DeployRequest d JOIN FETCH d.system JOIN FETCH d.requester LEFT JOIN FETCH d.redmineIssues WHERE d.system.id = :systemId ORDER BY d.createdAt DESC")
    List<DeployRequest> findBySystemId(Long systemId);

    @Query("SELECT DISTINCT d FROM DeployRequest d JOIN FETCH d.system JOIN FETCH d.requester LEFT JOIN FETCH d.redmineIssues WHERE d.status = :status ORDER BY d.createdAt DESC")
    List<DeployRequest> findByStatus(DeployRequest.Status status);

    @Query("SELECT d FROM DeployRequest d JOIN FETCH d.system JOIN FETCH d.requester LEFT JOIN FETCH d.redmineIssues WHERE d.id = :id")
    Optional<DeployRequest> findWithIssues(Long id);

    @Query("SELECT COUNT(d) FROM DeployRequest d WHERE d.createdAt >= :start AND d.createdAt < :end")
    long countByYear(LocalDateTime start, LocalDateTime end);
}
