package com.platform.portal.domain.system.service;

import com.platform.portal.domain.system.dto.SystemDto;
import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.entity.SubSystem;
import com.platform.portal.domain.system.entity.SystemManager;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.system.repository.SubSystemRepository;
import com.platform.portal.domain.system.repository.SystemManagerRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OperationSystemService {

    private final OperationSystemRepository systemRepository;
    private final SystemManagerRepository managerRepository;
    private final SubSystemRepository subSystemRepository;
    private final UserRepository userRepository;

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
        system.setRedmineProjectKey(req.getRedmineProjectKey());
        return new SystemDto.Response(systemRepository.save(system));
    }

    @Transactional
    public SystemDto.Response update(Long id, SystemDto.UpdateRequest req) {
        OperationSystem system = systemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + id));
        system.setName(req.getName());
        if (req.getDescription() != null) system.setDescription(req.getDescription());
        if (req.getActive() != null) system.setActive(req.getActive());
        system.setRedmineProjectKey(req.getRedmineProjectKey());
        return new SystemDto.Response(system);
    }

    @Transactional
    public void delete(Long id) {
        systemRepository.deleteById(id);
    }

    public List<SystemDto.ManagerResponse> findManagers(Long systemId) {
        return managerRepository.findBySystemId(systemId).stream()
                .map(SystemDto.ManagerResponse::new).toList();
    }

    @Transactional
    public SystemDto.ManagerResponse addManager(Long systemId, Long userId) {
        OperationSystem system = systemRepository.findById(systemId)
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + systemId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        if (managerRepository.existsBySystemIdAndUserId(systemId, userId)) {
            throw new IllegalArgumentException("이미 담당자로 등록된 사용자입니다.");
        }
        SystemManager sm = new SystemManager();
        sm.setSystem(system);
        sm.setUser(user);
        return new SystemDto.ManagerResponse(managerRepository.save(sm));
    }

    @Transactional
    public void removeManager(Long systemId, Long userId) {
        managerRepository.deleteBySystemIdAndUserId(systemId, userId);
    }

    public List<Long> findManagedSystemIds(String username) {
        return managerRepository.findSystemIdsByUsername(username);
    }

    public List<SystemDto.SubSystemResponse> findSubSystems(Long systemId) {
        return subSystemRepository.findBySystemId(systemId).stream()
                .map(SystemDto.SubSystemResponse::new).toList();
    }

    public List<SystemDto.SubSystemResponse> findActiveSubSystems(Long systemId) {
        return subSystemRepository.findBySystemIdAndActiveTrue(systemId).stream()
                .map(SystemDto.SubSystemResponse::new).toList();
    }

    @Transactional
    public SystemDto.SubSystemResponse createSubSystem(Long systemId, SystemDto.SubSystemCreateRequest req) {
        OperationSystem system = systemRepository.findById(systemId)
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + systemId));
        if (subSystemRepository.existsBySystemIdAndCode(systemId, req.getCode())) {
            throw new IllegalArgumentException("하위 시스템 코드가 이미 존재합니다: " + req.getCode());
        }
        SubSystem sub = new SubSystem();
        sub.setSystem(system);
        sub.setCode(req.getCode());
        sub.setName(req.getName());
        sub.setDescription(req.getDescription());
        return new SystemDto.SubSystemResponse(subSystemRepository.save(sub));
    }

    @Transactional
    public SystemDto.SubSystemResponse updateSubSystem(Long systemId, Long subId, SystemDto.SubSystemUpdateRequest req) {
        SubSystem sub = subSystemRepository.findById(subId)
                .orElseThrow(() -> new IllegalArgumentException("SubSystem not found: " + subId));
        if (!sub.getSystem().getId().equals(systemId)) {
            throw new IllegalArgumentException("하위 시스템이 해당 시스템에 속하지 않습니다.");
        }
        sub.setName(req.getName());
        if (req.getDescription() != null) sub.setDescription(req.getDescription());
        if (req.getActive() != null) sub.setActive(req.getActive());
        return new SystemDto.SubSystemResponse(sub);
    }

    @Transactional
    public void deleteSubSystem(Long systemId, Long subId) {
        SubSystem sub = subSystemRepository.findById(subId)
                .orElseThrow(() -> new IllegalArgumentException("SubSystem not found: " + subId));
        if (!sub.getSystem().getId().equals(systemId)) {
            throw new IllegalArgumentException("하위 시스템이 해당 시스템에 속하지 않습니다.");
        }
        subSystemRepository.deleteById(subId);
    }
}
