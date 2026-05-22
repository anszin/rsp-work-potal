package com.platform.portal.domain.report.service;

import com.platform.portal.domain.report.dto.DailyCheckReportDto;
import com.platform.portal.domain.report.entity.DailyCheckReport;
import com.platform.portal.domain.report.repository.DailyCheckReportRepository;
import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DailyCheckReportService {

    private final DailyCheckReportRepository repository;
    private final OperationSystemRepository systemRepository;

    public List<DailyCheckReportDto.Response> findAll() {
        return repository.findAllByOrderByCheckDateDescCreatedAtDesc().stream()
                .map(DailyCheckReportDto.Response::new).toList();
    }

    public List<DailyCheckReportDto.Response> findByDate(LocalDate date) {
        return repository.findByCheckDateOrderBySystemAsc(date).stream()
                .map(DailyCheckReportDto.Response::new).toList();
    }

    public DailyCheckReportDto.Response findById(Long id) {
        return repository.findById(id)
                .map(DailyCheckReportDto.Response::new)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
    }

    @Transactional
    public DailyCheckReportDto.Response create(DailyCheckReportDto.SaveRequest req, String reporter) {
        OperationSystem system = systemRepository.findById(req.getSystemId())
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + req.getSystemId()));
        DailyCheckReport r = new DailyCheckReport();
        r.setSystem(system);
        r.setCheckDate(req.getCheckDate());
        r.setStatus(req.getStatus());
        r.setNote(req.getNote());
        r.setReporter(reporter);
        return new DailyCheckReportDto.Response(repository.save(r));
    }

    @Transactional
    public DailyCheckReportDto.Response update(Long id, DailyCheckReportDto.SaveRequest req) {
        DailyCheckReport r = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
        OperationSystem system = systemRepository.findById(req.getSystemId())
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + req.getSystemId()));
        r.setSystem(system);
        r.setCheckDate(req.getCheckDate());
        r.setStatus(req.getStatus());
        r.setNote(req.getNote());
        return new DailyCheckReportDto.Response(r);
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
    }
}
