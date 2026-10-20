package com.platform.portal.domain.report.service;

import com.platform.portal.domain.report.dto.WeeklyReportDto;
import com.platform.portal.domain.report.entity.WeeklyReport;
import com.platform.portal.domain.report.repository.WeeklyReportRepository;
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
public class WeeklyReportService {

    private final WeeklyReportRepository repository;
    private final UserLookup userLookup;

    public List<WeeklyReportDto.Response> findAll(String username) {
        if (userLookup.isAdminOrManager(username)) {
            return toResponses(repository.findByReportTypeOrderByWeekStartDescCreatedAtDesc(WeeklyReport.ReportType.INDIVIDUAL));
        }
        return toResponses(repository.findByAuthorAndReportTypeOrderByWeekStartDescCreatedAtDesc(username, WeeklyReport.ReportType.INDIVIDUAL));
    }

    public WeeklyReportDto.Response findById(Long id) {
        WeeklyReport r = getOrThrow(id);
        return new WeeklyReportDto.Response(r, userLookup.nameOf(r.getAuthor()));
    }

    public List<WeeklyReportDto.Response> findByWeek(LocalDate weekStart) {
        return toResponses(repository.findByWeekStartAndReportTypeOrderByCreatedAtDesc(weekStart, WeeklyReport.ReportType.INDIVIDUAL));
    }

    public List<WeeklyReportDto.Response> findAllConsolidated() {
        return toResponses(repository.findByReportTypeOrderByWeekStartDescCreatedAtDesc(WeeklyReport.ReportType.CONSOLIDATED));
    }

    @Transactional
    public WeeklyReportDto.Response create(WeeklyReportDto.SaveRequest req, String author) {
        WeeklyReport r = new WeeklyReport();
        r.setReportType(WeeklyReport.ReportType.INDIVIDUAL);
        apply(r, req);
        r.setAuthor(author);
        repository.save(r);
        return new WeeklyReportDto.Response(r, userLookup.nameOf(author));
    }

    @Transactional
    public WeeklyReportDto.Response createConsolidated(WeeklyReportDto.SaveRequest req, String author) {
        WeeklyReport r = new WeeklyReport();
        r.setReportType(WeeklyReport.ReportType.CONSOLIDATED);
        apply(r, req);
        r.setAuthor(author);
        repository.save(r);
        return new WeeklyReportDto.Response(r, userLookup.nameOf(author));
    }

    @Transactional
    public WeeklyReportDto.Response update(Long id, WeeklyReportDto.SaveRequest req, String actorUsername) {
        WeeklyReport r = getOrThrow(id);
        checkOwnership(r, actorUsername);
        apply(r, req);
        return new WeeklyReportDto.Response(r, userLookup.nameOf(r.getAuthor()));
    }

    @Transactional
    public void delete(Long id, String actorUsername) {
        WeeklyReport r = getOrThrow(id);
        checkOwnership(r, actorUsername);
        repository.delete(r);
    }

    /**
     * 소유자 검사 (F-AUTH-001 R-001, L1 ①)
     * - 통합 보고서: ADMIN/MANAGER 만
     * - 개인 보고서: 작성자 본인 또는 ADMIN/MANAGER
     */
    private void checkOwnership(WeeklyReport r, String actorUsername) {
        boolean isAdminOrManager = userLookup.isAdminOrManager(actorUsername);
        if (r.getReportType() == WeeklyReport.ReportType.CONSOLIDATED) {
            if (!isAdminOrManager) throw new AccessDeniedException("통합 보고서는 관리자만 수정·삭제할 수 있습니다.");
            return;
        }
        if (!isAdminOrManager && !actorUsername.equals(r.getAuthor())) {
            throw new AccessDeniedException("본인 보고서만 수정·삭제할 수 있습니다.");
        }
    }

    private WeeklyReport getOrThrow(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
    }

    private List<WeeklyReportDto.Response> toResponses(List<WeeklyReport> reports) {
        Map<String, String> names = userLookup.namesOf(reports.stream().map(WeeklyReport::getAuthor).toList());
        return reports.stream().map(r -> new WeeklyReportDto.Response(r, names.get(r.getAuthor()))).toList();
    }

    private void apply(WeeklyReport r, WeeklyReportDto.SaveRequest req) {
        r.setTitle(req.getTitle());
        r.setWeekStart(req.getWeekStart());
        r.setWeekEnd(req.getWeekEnd());
        r.setThisWeekWork(req.getThisWeekWork());
        r.setThisWeekProposal(req.getThisWeekProposal());
        r.setThisWeekEtc(req.getThisWeekEtc());
        r.setNextWeekWork(req.getNextWeekWork());
        r.setNextWeekProposal(req.getNextWeekProposal());
        r.setNextWeekEtc(req.getNextWeekEtc());
    }
}
