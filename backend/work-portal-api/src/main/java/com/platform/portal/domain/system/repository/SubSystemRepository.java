package com.platform.portal.domain.system.repository;

import com.platform.portal.domain.system.entity.SubSystem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubSystemRepository extends JpaRepository<SubSystem, Long> {
    List<SubSystem> findBySystemId(Long systemId);
    List<SubSystem> findBySystemIdAndActiveTrue(Long systemId);
    boolean existsBySystemIdAndCode(Long systemId, String code);
}
