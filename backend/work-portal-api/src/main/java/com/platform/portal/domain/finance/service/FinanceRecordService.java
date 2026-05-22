package com.platform.portal.domain.finance.service;

import com.platform.portal.domain.finance.dto.FinanceRecordDto;
import com.platform.portal.domain.finance.entity.FinanceRecord;
import com.platform.portal.domain.finance.repository.FinanceRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Year;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FinanceRecordService {

    private final FinanceRecordRepository repository;

    public List<FinanceRecordDto.Response> findByYear(int year) {
        return repository.findByYearOrderByMonthAscCreatedAtDesc(year).stream()
                .map(FinanceRecordDto.Response::new).toList();
    }

    public List<FinanceRecordDto.Response> findByYearMonth(int year, int month) {
        return repository.findByYearAndMonthOrderByCreatedAtDesc(year, month).stream()
                .map(FinanceRecordDto.Response::new).toList();
    }

    public List<FinanceRecordDto.MonthlySummary> getMonthlySummary(int year) {
        List<Object[]> rows = repository.findMonthlySummary(year);
        Map<Integer, FinanceRecordDto.MonthlySummary> map = rows.stream().collect(
                Collectors.toMap(
                        r -> ((Number) r[0]).intValue(),
                        r -> {
                            long rev = ((Number) r[1]).longValue();
                            long exp = ((Number) r[2]).longValue();
                            return new FinanceRecordDto.MonthlySummary(
                                    ((Number) r[0]).intValue(), rev, exp, rev - exp);
                        }
                )
        );
        List<FinanceRecordDto.MonthlySummary> result = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            result.add(map.getOrDefault(m, new FinanceRecordDto.MonthlySummary(m, 0, 0, 0)));
        }
        return result;
    }

    public List<Integer> getAvailableYears() {
        List<Integer> years = repository.findDistinctYears();
        int current = Year.now().getValue();
        if (!years.contains(current)) years.add(0, current);
        return years;
    }

    @Transactional
    public FinanceRecordDto.Response create(FinanceRecordDto.SaveRequest req) {
        FinanceRecord r = new FinanceRecord();
        apply(r, req);
        return new FinanceRecordDto.Response(repository.save(r));
    }

    @Transactional
    public FinanceRecordDto.Response update(Long id, FinanceRecordDto.SaveRequest req) {
        FinanceRecord r = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Record not found: " + id));
        apply(r, req);
        return new FinanceRecordDto.Response(r);
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private void apply(FinanceRecord r, FinanceRecordDto.SaveRequest req) {
        r.setYear(req.getYear());
        r.setMonth(req.getMonth());
        r.setCategory(req.getCategory());
        r.setItemName(req.getItemName());
        r.setAmount(req.getAmount());
        r.setNote(req.getNote());
    }
}
