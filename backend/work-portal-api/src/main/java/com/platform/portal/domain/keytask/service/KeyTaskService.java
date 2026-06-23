package com.platform.portal.domain.keytask.service;

import com.platform.portal.domain.keytask.dto.KeyTaskDto;
import com.platform.portal.domain.keytask.entity.KeyTask;
import com.platform.portal.domain.keytask.repository.KeyTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KeyTaskService {

    private final KeyTaskRepository repo;

    public List<KeyTaskDto.Response> findByYear(Integer year) {
        return repo.findByYearOrderBySortOrderAscIdAsc(year).stream()
                .map(KeyTaskDto.Response::new).toList();
    }

    public List<Integer> getYears() {
        return repo.findDistinctYears();
    }

    @Transactional
    public KeyTaskDto.Response create(KeyTaskDto.SaveRequest req) {
        KeyTask kt = new KeyTask();
        apply(kt, req);
        return new KeyTaskDto.Response(repo.save(kt));
    }

    @Transactional
    public KeyTaskDto.Response update(Long id, KeyTaskDto.SaveRequest req) {
        KeyTask kt = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("KeyTask not found: " + id));
        apply(kt, req);
        return new KeyTaskDto.Response(kt);
    }

    @Transactional
    public void delete(Long id) {
        repo.deleteById(id);
    }

    private void apply(KeyTask kt, KeyTaskDto.SaveRequest req) {
        kt.setYear(req.getYear());
        kt.setParentId(req.getParentId());
        kt.setTeamName(req.getTeamName());
        kt.setAssigneeName(req.getAssigneeName());
        kt.setKpi(req.getKpi());
        kt.setTaskName(req.getTaskName());
        kt.setQ1Plan(req.getQ1Plan()); kt.setQ2Plan(req.getQ2Plan());
        kt.setQ3Plan(req.getQ3Plan()); kt.setQ4Plan(req.getQ4Plan());
        kt.setQ1Result(req.getQ1Result()); kt.setQ2Result(req.getQ2Result());
        kt.setQ3Result(req.getQ3Result()); kt.setQ4Result(req.getQ4Result());
        kt.setQ1Achievement(req.getQ1Achievement()); kt.setQ2Achievement(req.getQ2Achievement());
        kt.setQ3Achievement(req.getQ3Achievement()); kt.setQ4Achievement(req.getQ4Achievement());
        kt.setQ1Reason(req.getQ1Reason()); kt.setQ2Reason(req.getQ2Reason());
        kt.setQ3Reason(req.getQ3Reason()); kt.setQ4Reason(req.getQ4Reason());
        kt.setSortOrder(req.getSortOrder());
    }
}
