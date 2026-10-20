package com.platform.portal.domain.request.repository;

import com.platform.portal.domain.request.entity.ChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ChangeRequestRepository extends JpaRepository<ChangeRequest, Long> {

    @Query("SELECT DISTINCT c FROM ChangeRequest c JOIN FETCH c.system JOIN FETCH c.requester LEFT JOIN FETCH c.redmineIssues ORDER BY c.createdAt DESC")
    List<ChangeRequest> findAllWithDetails();

    @Query("SELECT DISTINCT c FROM ChangeRequest c JOIN FETCH c.system JOIN FETCH c.requester LEFT JOIN FETCH c.redmineIssues WHERE c.system.id = :systemId ORDER BY c.createdAt DESC")
    List<ChangeRequest> findBySystemId(Long systemId);

    @Query("SELECT DISTINCT c FROM ChangeRequest c JOIN FETCH c.system JOIN FETCH c.requester LEFT JOIN FETCH c.redmineIssues WHERE c.status = :status ORDER BY c.createdAt DESC")
    List<ChangeRequest> findByStatus(ChangeRequest.Status status);

    // 채번: 그 해 최대 일련번호 (삭제 후 중복 방지, DeployRequestRepository.maxSeqByYear 와 동일 방식). "CR-yyyy-" 8자 이후가 일련번호
    @Query(value = "SELECT COALESCE(MAX(CAST(SUBSTRING(request_no, 9) AS INTEGER)), 0) FROM change_requests WHERE created_at >= :start AND created_at < :end AND request_no IS NOT NULL", nativeQuery = true)
    long maxSeqByYear(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    boolean existsByRequesterId(Long requesterId);
}
