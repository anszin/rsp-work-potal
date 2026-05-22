package com.platform.portal.domain.report.repository;

import com.platform.portal.domain.report.entity.DailyCheckReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface DailyCheckReportRepository extends JpaRepository<DailyCheckReport, Long> {
    List<DailyCheckReport> findAllByOrderByCheckDateDescCreatedAtDesc();
    List<DailyCheckReport> findByCheckDateOrderBySystemAsc(LocalDate checkDate);
    List<DailyCheckReport> findBySystemIdOrderByCheckDateDesc(Long systemId);
}
