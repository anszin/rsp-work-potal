package com.platform.portal.domain.request.repository;

import com.platform.portal.domain.request.entity.ChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ChangeRequestRepository extends JpaRepository<ChangeRequest, Long> {

    @Query("SELECT c FROM ChangeRequest c JOIN FETCH c.system JOIN FETCH c.requester ORDER BY c.createdAt DESC")
    List<ChangeRequest> findAllWithDetails();

    @Query("SELECT c FROM ChangeRequest c JOIN FETCH c.system JOIN FETCH c.requester WHERE c.system.id = :systemId ORDER BY c.createdAt DESC")
    List<ChangeRequest> findBySystemId(Long systemId);

    @Query("SELECT c FROM ChangeRequest c JOIN FETCH c.system JOIN FETCH c.requester WHERE c.status = :status ORDER BY c.createdAt DESC")
    List<ChangeRequest> findByStatus(ChangeRequest.Status status);

    @Query("SELECT COUNT(c) FROM ChangeRequest c WHERE c.createdAt >= :start AND c.createdAt < :end")
    long countByYear(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
