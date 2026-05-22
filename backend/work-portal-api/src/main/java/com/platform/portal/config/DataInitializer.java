package com.platform.portal.config;

import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final OperationSystemRepository systemRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        initAdmin();
        initSystems();
    }

    private void initAdmin() {
        if (!userRepository.existsByUsername("admin")) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setEmail("admin@portal.com");
            admin.setPassword(passwordEncoder.encode("admin123!"));
            admin.setRole(User.Role.ADMIN);
            userRepository.save(admin);
            log.info("Admin user created: admin / admin123!");
        }
    }

    private void initSystems() {
        if (systemRepository.count() == 0) {
            createSystem("SYS001", "운영시스템 A", "첫 번째 운영시스템");
            createSystem("SYS002", "운영시스템 B", "두 번째 운영시스템");
            log.info("Default systems created: SYS001, SYS002");
        }
    }

    private void createSystem(String code, String name, String desc) {
        OperationSystem sys = new OperationSystem();
        sys.setCode(code);
        sys.setName(name);
        sys.setDescription(desc);
        systemRepository.save(sys);
    }
}
