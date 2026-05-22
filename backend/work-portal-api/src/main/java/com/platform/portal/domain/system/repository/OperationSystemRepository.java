package com.platform.portal.domain.system.repository;

import com.platform.portal.domain.system.entity.OperationSystem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OperationSystemRepository extends JpaRepository<OperationSystem, Long> {
    List<OperationSystem> findByActiveTrue();
    Optional<OperationSystem> findByCode(String code);
    boolean existsByCode(String code);
}
