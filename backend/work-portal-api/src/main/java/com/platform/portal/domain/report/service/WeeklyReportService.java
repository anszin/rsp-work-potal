package com.platform.portal.domain.report.service;

import com.platform.portal.domain.report.dto.WeeklyReportDto;
import com.platform.portal.domain.report.entity.WeeklyReport;
import com.platform.portal.domain.report.repository.WeeklyReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WeeklyReportService {

    private final WeeklyReportRepository repository;

    public List<WeeklyReportDto.Response> findAll() {
        return repository.findAllByOrderByWeekStartDescCreatedAtDesc().stream()
                .map(WeeklyReportDto.Response::new).toList();
    }

    public WeeklyReportDto.Response findById(Long id) {
        return repository.findById(id)
                .map(WeeklyReportDto.Response::new)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
    }

    @Transactional
    public WeeklyReportDto.Response create(WeeklyReportDto.SaveRequest req, String author) {
        WeeklyReport r = new WeeklyReport();
        apply(r, req);
        r.setAuthor(author);
        return new WeeklyReportDto.Response(repository.save(r));
    }

    @Transactional
    public WeeklyReportDto.Response update(Long id, WeeklyReportDto.SaveRequest req) {
        WeeklyReport r = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
        apply(r, req);
        return new WeeklyReportDto.Response(r);
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
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
