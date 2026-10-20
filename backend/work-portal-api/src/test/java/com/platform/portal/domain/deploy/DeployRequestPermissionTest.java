package com.platform.portal.domain.deploy;

import com.platform.portal.domain.deploy.entity.DeployRequest;
import com.platform.portal.domain.deploy.repository.DeployRequestRepository;
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
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * F-AUTH-001 R-005 (담당자 판정에서 EXTERNAL 제외, 거부 500→403) + R-006 (EXTERNAL 배포 API 차단).
 * DRAFT→REQUESTED 제출로 검증 — 외부 연동(Redmine) 호출이 없는 전환.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class DeployRequestPermissionTest extends AuthTestSupport {

    @Autowired MockMvc mvc;
    @Autowired OperationSystemRepository systemRepository;
    @Autowired SystemManagerRepository managerRepository;
    @Autowired DeployRequestRepository deployRequestRepository;

    private static final String SUBMIT = "{\"status\":\"REQUESTED\"}";

    @Test
    @DisplayName("R-005: EXTERNAL 담당자는 제출할 수 없다 (403, 현행 200)")
    void externalManagerCannotSubmit() throws Exception {
        User ext = user("dr-ext", User.Role.EXTERNAL);
        OperationSystem sys = systemRepository.findAll().get(0);
        manager(sys, ext);
        DeployRequest dr = draft(sys, ext);

        mvc.perform(patch("/api/deploy-requests/" + dr.getId() + "/status").header("Authorization", bearer(ext))
                        .contentType(MediaType.APPLICATION_JSON).content(SUBMIT))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("R-005: MEMBER 담당자는 제출할 수 있다 (200)")
    void memberManagerCanSubmit() throws Exception {
        User mem = user("dr-mem", User.Role.MEMBER);
        OperationSystem sys = systemRepository.findAll().get(0);
        manager(sys, mem);
        DeployRequest dr = draft(sys, mem);

        mvc.perform(patch("/api/deploy-requests/" + dr.getId() + "/status").header("Authorization", bearer(mem))
                        .contentType(MediaType.APPLICATION_JSON).content(SUBMIT))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("R-005: 담당자가 아닌 MEMBER 의 제출은 403 이다 (현행 500)")
    void unrelatedMemberGets403() throws Exception {
        User mem = user("dr-mem3", User.Role.MEMBER);
        DeployRequest dr = draft(systemRepository.findAll().get(0), mem);

        mvc.perform(patch("/api/deploy-requests/" + dr.getId() + "/status").header("Authorization", bearer(mem))
                        .contentType(MediaType.APPLICATION_JSON).content(SUBMIT))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("R-006: EXTERNAL 은 배포 목록을 볼 수 없다 (403), MEMBER 는 본다 (200)")
    void externalBlockedFromDeployApi() throws Exception {
        User ext = user("dr-ext6", User.Role.EXTERNAL);
        User mem = user("dr-mem6", User.Role.MEMBER);

        mvc.perform(get("/api/deploy-requests").header("Authorization", bearer(ext)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/deploy-requests").header("Authorization", bearer(mem)))
                .andExpect(status().isOk());
    }

    private void manager(OperationSystem sys, User u) {
        SystemManager sm = new SystemManager();
        sm.setSystem(sys);
        sm.setUser(u);
        managerRepository.saveAndFlush(sm);
    }

    private DeployRequest draft(OperationSystem sys, User requester) {
        DeployRequest dr = new DeployRequest();
        dr.setSystem(sys);
        dr.setRequester(requester);
        dr.setTitle("배포");
        dr.setDeployType(DeployRequest.DeployType.PATCH);
        dr.setStatus(DeployRequest.Status.DRAFT);
        return deployRequestRepository.saveAndFlush(dr);
    }
}
