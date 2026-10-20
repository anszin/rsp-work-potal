package com.platform.portal.domain.deploy;

import com.platform.portal.domain.deploy.entity.DeployRequest;
import com.platform.portal.domain.deploy.entity.DeployStep;
import com.platform.portal.domain.deploy.repository.DeployRequestRepository;
import com.platform.portal.domain.deploy.repository.DeployStepRepository;
import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.entity.SystemManager;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.system.repository.SystemManagerRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.support.AuthTestSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** F-AUTH-001 R-004 — 배포 단계 완료 권한 (#10). 현행: 로그인한 누구나 완료 가능(200). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class DeployStepPermissionTest extends AuthTestSupport {

    @Autowired MockMvc mvc;
    @Autowired OperationSystemRepository systemRepository;
    @Autowired SystemManagerRepository managerRepository;
    @Autowired DeployRequestRepository deployRequestRepository;
    @Autowired DeployStepRepository stepRepository;

    @Test
    @DisplayName("해당 시스템 담당자(MEMBER)는 단계를 완료할 수 있다 (200)")
    void systemManagerMemberCanComplete() throws Exception {
        User mem = user("ds-mem", User.Role.MEMBER);
        OperationSystem sys = systemRepository.findAll().get(0);
        manager(sys, mem);
        DeployStep step = step(sys, mem);

        mvc.perform(post("/api/deploy-requests/steps/" + step.getId() + "/complete").header("Authorization", bearer(mem)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("EXTERNAL 은 담당자로 등록돼 있어도 완료할 수 없다 (403)")
    void externalManagerCannotComplete() throws Exception {
        User req = user("ds-req2", User.Role.MEMBER);
        User ext = user("ds-ext2", User.Role.EXTERNAL);
        OperationSystem sys = systemRepository.findAll().get(0);
        manager(sys, ext);
        DeployStep step = step(sys, req);

        mvc.perform(post("/api/deploy-requests/steps/" + step.getId() + "/complete").header("Authorization", bearer(ext)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("담당자가 아닌 MEMBER 는 완료할 수 없다 (403)")
    void unrelatedMemberCannotComplete() throws Exception {
        User req = user("ds-req3", User.Role.MEMBER);
        User other = user("ds-other3", User.Role.MEMBER);
        DeployStep step = step(systemRepository.findAll().get(0), req);

        mvc.perform(post("/api/deploy-requests/steps/" + step.getId() + "/complete").header("Authorization", bearer(other)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("ADMIN 은 담당자가 아니어도 완료할 수 있다 (200)")
    void adminCanComplete() throws Exception {
        User req = user("ds-req4", User.Role.MEMBER);
        DeployStep step = step(systemRepository.findAll().get(0), req);

        mvc.perform(post("/api/deploy-requests/steps/" + step.getId() + "/complete").header("Authorization", bearer("admin")))
                .andExpect(status().isOk());
    }

    private void manager(OperationSystem sys, User u) {
        SystemManager sm = new SystemManager();
        sm.setSystem(sys);
        sm.setUser(u);
        managerRepository.saveAndFlush(sm);
    }

    private DeployStep step(OperationSystem sys, User requester) {
        DeployRequest dr = new DeployRequest();
        dr.setSystem(sys);
        dr.setRequester(requester);
        dr.setTitle("배포");
        dr.setDeployType(DeployRequest.DeployType.PATCH);
        dr.setStatus(DeployRequest.Status.APPROVED);
        deployRequestRepository.saveAndFlush(dr);
        return stepRepository.saveAndFlush(new DeployStep(dr, "srv-1", 1));
    }
}
