package com.platform.portal.domain.report;

import com.platform.portal.domain.report.entity.DailyCheckReport;
import com.platform.portal.domain.report.repository.DailyCheckReportRepository;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
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

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** F-AUTH-001 R-002 — 일일점검 소유자 검사. 현행: 누구나 삭제 가능(204). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class DailyCheckOwnershipTest extends AuthTestSupport {

    @Autowired MockMvc mvc;
    @Autowired DailyCheckReportRepository repository;
    @Autowired OperationSystemRepository systemRepository;

    @Test
    @DisplayName("다른 MEMBER 는 남의 점검 보고를 삭제할 수 없다 (403)")
    void otherMemberCannotDelete() throws Exception {
        User a = user("dc-a", User.Role.MEMBER);
        User b = user("dc-b", User.Role.MEMBER);
        DailyCheckReport r = report(a.getUsername());

        mvc.perform(delete("/api/daily-checks/" + r.getId()).header("Authorization", bearer(b)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("보고자 본인과 MANAGER 는 삭제할 수 있다 (204)")
    void ownerAndManagerCanDelete() throws Exception {
        User a = user("dc-a2", User.Role.MEMBER);
        User m = user("dc-m2", User.Role.MANAGER);
        DailyCheckReport r1 = report(a.getUsername());
        DailyCheckReport r2 = report(a.getUsername());

        mvc.perform(delete("/api/daily-checks/" + r1.getId()).header("Authorization", bearer(a)))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/daily-checks/" + r2.getId()).header("Authorization", bearer(m)))
                .andExpect(status().isNoContent());
    }

    private DailyCheckReport report(String reporter) {
        DailyCheckReport r = new DailyCheckReport();
        r.setSystem(systemRepository.findAll().get(0));
        r.setCheckDate(LocalDate.now());
        r.setStatus(DailyCheckReport.CheckStatus.NORMAL);
        r.setReporter(reporter);
        return repository.saveAndFlush(r);
    }
}
