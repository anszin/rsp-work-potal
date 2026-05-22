package com.platform.portal.domain.system.service;

import com.platform.portal.domain.system.dto.SystemDto;
import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OperationSystemService {

    private final OperationSystemRepository systemRepository;

    public List<SystemDto.Response> findAll() {
        return systemRepository.findAll().stream()
                .map(SystemDto.Response::new)
                .toList();
    }

    public List<SystemDto.Response> findActive() {
        return systemRepository.findByActiveTrue().stream()
                .map(SystemDto.Response::new)
                .toList();
    }

    public SystemDto.Response findById(Long id) {
        return systemRepository.findById(id)
                .map(SystemDto.Response::new)
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + id));
    }

    @Transactional
    public SystemDto.Response create(SystemDto.CreateRequest req) {
        if (systemRepository.existsByCode(req.getCode())) {
            throw new IllegalArgumentException("System code already exists: " + req.getCode());
        }
        OperationSystem system = new OperationSystem();
        system.setCode(req.getCode());
        system.setName(req.getName());
        system.setDescription(req.getDescription());
        return new SystemDto.Response(systemRepository.save(system));
    }

    @Transactional
    public SystemDto.Response update(Long id, SystemDto.UpdateRequest req) {
        OperationSystem system = systemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + id));
        system.setName(req.getName());
        if (req.getDescription() != null) system.setDescription(req.getDescription());
        if (req.getActive() != null) system.setActive(req.getActive());
        return new SystemDto.Response(system);
    }

    @Transactional
    public void delete(Long id) {
        systemRepository.deleteById(id);
    }
}
