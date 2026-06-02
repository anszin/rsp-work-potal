package com.platform.portal.domain.system.repository;

import com.platform.portal.domain.system.entity.SystemManager;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SystemManagerRepository extends JpaRepository<SystemManager, Long> {

    List<SystemManager> findBySystemId(Long systemId);

    boolean existsBySystemIdAndUserId(Long systemId, Long userId);

    void deleteBySystemIdAndUserId(Long systemId, Long userId);

    @Query("SELECT sm.system.id FROM SystemManager sm WHERE sm.user.username = :username")
    List<Long> findSystemIdsByUsername(@Param("username") String username);
}
