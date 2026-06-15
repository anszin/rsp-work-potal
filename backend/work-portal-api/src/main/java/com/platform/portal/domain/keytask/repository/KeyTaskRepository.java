package com.platform.portal.domain.keytask.repository;

import com.platform.portal.domain.keytask.entity.KeyTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface KeyTaskRepository extends JpaRepository<KeyTask, Long> {
    List<KeyTask> findByYearOrderBySortOrderAscIdAsc(Integer year);

    @Query("SELECT DISTINCT k.year FROM KeyTask k ORDER BY k.year DESC")
    List<Integer> findDistinctYears();
}
