package com.platform.portal.domain.workunit.service;

import com.platform.portal.domain.workunit.dto.WorkUnitDto;
import com.platform.portal.domain.workunit.entity.WorkUnit;
import com.platform.portal.domain.workunit.repository.WorkUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkUnitService {

    private final WorkUnitRepository repository;

    public List<WorkUnitDto.Response> findByKeyTask(Long keyTaskId) {
        return repository.findByKeyTaskIdOrderByCreatedAtAsc(keyTaskId)
                .stream().map(WorkUnitDto.Response::new).toList();
    }

    @Transactional
    public WorkUnitDto.Response create(WorkUnitDto.SaveRequest req) {
        WorkUnit w = new WorkUnit();
        apply(w, req);
        return new WorkUnitDto.Response(repository.save(w));
    }

    @Transactional
    public WorkUnitDto.Response update(Long id, WorkUnitDto.SaveRequest req) {
        WorkUnit w = repository.findById(id).orElseThrow();
        apply(w, req);
        return new WorkUnitDto.Response(repository.save(w));
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private void apply(WorkUnit w, WorkUnitDto.SaveRequest req) {
        w.setKeyTaskId(req.getKeyTaskId());
        w.setTitle(req.getTitle());
        if (req.getType() != null) w.setType(req.getType());
        if (req.getStatus() != null) w.setStatus(req.getStatus());
        w.setDescription(req.getDescription());
    }
}
