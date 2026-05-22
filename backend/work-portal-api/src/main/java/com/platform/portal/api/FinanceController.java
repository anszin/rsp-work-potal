package com.platform.portal.api;

import com.platform.portal.domain.finance.dto.FinanceRecordDto;
import com.platform.portal.domain.finance.service.FinanceRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/finance")
@RequiredArgsConstructor
public class FinanceController {

    private final FinanceRecordService service;

    @GetMapping
    public List<FinanceRecordDto.Response> list(
            @RequestParam int year,
            @RequestParam(required = false) Integer month) {
        if (month != null) return service.findByYearMonth(year, month);
        return service.findByYear(year);
    }

    @GetMapping("/summary")
    public List<FinanceRecordDto.MonthlySummary> summary(@RequestParam int year) {
        return service.getMonthlySummary(year);
    }

    @GetMapping("/years")
    public List<Integer> years() {
        return service.getAvailableYears();
    }

    @PostMapping
    public FinanceRecordDto.Response create(@Valid @RequestBody FinanceRecordDto.SaveRequest req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    public FinanceRecordDto.Response update(
            @PathVariable Long id,
            @Valid @RequestBody FinanceRecordDto.SaveRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
