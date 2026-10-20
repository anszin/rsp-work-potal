package com.platform.portal.domain.report.service;

import com.platform.portal.domain.report.dto.DailyCheckReportDto;
import com.platform.portal.domain.report.entity.DailyCheckReport;
import com.platform.portal.domain.report.repository.DailyCheckReportRepository;
import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.user.service.UserLookup;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DailyCheckReportService {

    private final DailyCheckReportRepository repository;
    private final OperationSystemRepository systemRepository;
    private final UserLookup userLookup;

    public List<DailyCheckReportDto.Response> findAll() {
        return toResponses(repository.findAllByOrderByCheckDateDescCreatedAtDesc());
    }

    public List<DailyCheckReportDto.Response> findByDate(LocalDate date) {
        return toResponses(repository.findByCheckDateOrderBySystemAsc(date));
    }

    public DailyCheckReportDto.Response findById(Long id) {
        DailyCheckReport r = getOrThrow(id);
        return new DailyCheckReportDto.Response(r, userLookup.nameOf(r.getReporter()));
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
        repository.save(r);
        return new DailyCheckReportDto.Response(r, userLookup.nameOf(reporter));
    }

    @Transactional
    public DailyCheckReportDto.Response update(Long id, DailyCheckReportDto.SaveRequest req, String actorUsername) {
        DailyCheckReport r = getOrThrow(id);
        checkOwnership(r, actorUsername);
        OperationSystem system = systemRepository.findById(req.getSystemId())
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + req.getSystemId()));
        r.setSystem(system);
        r.setCheckDate(req.getCheckDate());
        r.setStatus(req.getStatus());
        r.setNote(req.getNote());
        return new DailyCheckReportDto.Response(r, userLookup.nameOf(r.getReporter()));
    }

    @Transactional
    public void delete(Long id, String actorUsername) {
        DailyCheckReport r = getOrThrow(id);
        checkOwnership(r, actorUsername);
        repository.delete(r);
    }

    /** 소유자 검사 (F-AUTH-001 R-002): 보고자 본인 또는 ADMIN/MANAGER */
    private void checkOwnership(DailyCheckReport r, String actorUsername) {
        if (!actorUsername.equals(r.getReporter()) && !userLookup.isAdminOrManager(actorUsername)) {
            throw new AccessDeniedException("본인 점검 보고만 수정·삭제할 수 있습니다.");
        }
    }

    private DailyCheckReport getOrThrow(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
    }

    private List<DailyCheckReportDto.Response> toResponses(List<DailyCheckReport> reports) {
        Map<String, String> names = userLookup.namesOf(reports.stream().map(DailyCheckReport::getReporter).toList());
        return reports.stream().map(r -> new DailyCheckReportDto.Response(r, names.get(r.getReporter()))).toList();
    }
}
