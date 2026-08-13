package com.platform.portal.domain.workunit.repository;

import com.platform.portal.domain.workunit.entity.WorkUnit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WorkUnitRepository extends JpaRepository<WorkUnit, Long> {
    List<WorkUnit> findByKeyTaskIdOrderByCreatedAtAsc(Long keyTaskId);
}
