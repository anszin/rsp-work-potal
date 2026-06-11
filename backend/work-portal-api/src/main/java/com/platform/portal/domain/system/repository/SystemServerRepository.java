package com.platform.portal.domain.system.repository;

import com.platform.portal.domain.system.entity.SystemServer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SystemServerRepository extends JpaRepository<SystemServer, Long> {
    List<SystemServer> findBySubSystemIdOrderByStepOrder(Long subSystemId);
}
