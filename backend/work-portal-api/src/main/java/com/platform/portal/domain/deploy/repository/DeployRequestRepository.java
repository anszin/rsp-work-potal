package com.platform.portal.domain.deploy.repository;

import com.platform.portal.domain.deploy.entity.DeployRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface DeployRequestRepository extends JpaRepository<DeployRequest, Long> {

    @Query("SELECT d FROM DeployRequest d JOIN FETCH d.system JOIN FETCH d.requester ORDER BY d.createdAt DESC")
    List<DeployRequest> findAllWithDetails();

    @Query("SELECT d FROM DeployRequest d JOIN FETCH d.system JOIN FETCH d.requester WHERE d.system.id = :systemId ORDER BY d.createdAt DESC")
    List<DeployRequest> findBySystemId(Long systemId);

    @Query("SELECT d FROM DeployRequest d JOIN FETCH d.system JOIN FETCH d.requester WHERE d.status = :status ORDER BY d.createdAt DESC")
    List<DeployRequest> findByStatus(DeployRequest.Status status);
}
