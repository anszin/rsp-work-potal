package com.platform.portal.domain.system.repository;

import com.platform.portal.domain.system.entity.OperationSystem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface OperationSystemRepository extends JpaRepository<OperationSystem, Long> {
    @Query("SELECT s FROM OperationSystem s ORDER BY s.sortOrder ASC, s.id ASC")
    List<OperationSystem> findAllOrdered();

    @Query("SELECT s FROM OperationSystem s WHERE s.active = true ORDER BY s.sortOrder ASC, s.id ASC")
    List<OperationSystem> findActiveOrdered();

    Optional<OperationSystem> findByCode(String code);
    boolean existsByCode(String code);
}
