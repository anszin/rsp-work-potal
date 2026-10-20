package com.platform.portal.domain.report;

import com.platform.portal.domain.report.entity.WeeklyReport;
import com.platform.portal.domain.report.repository.WeeklyReportRepository;
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

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** F-AUTH-001 R-001 — 주간보고 소유자 검사. 현행: 누구나 수정·삭제 가능(200). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class WeeklyReportOwnershipTest extends AuthTestSupport {

    @Autowired MockMvc mvc;
    @Autowired WeeklyReportRepository repository;

    private static final String BODY = "{\"title\":\"수정\",\"weekStart\":\"2026-10-19\",\"weekEnd\":\"2026-10-25\"}";

    @Test
    @DisplayName("작성자 본인은 개인 보고서를 수정할 수 있다 (200)")
    void ownerCanUpdate() throws Exception {
        User a = user("wr-a", User.Role.MEMBER);
        WeeklyReport r = report(a.getUsername(), WeeklyReport.ReportType.INDIVIDUAL);

        mvc.perform(put("/api/weekly-reports/" + r.getId()).header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("다른 MEMBER 는 남의 개인 보고서를 수정·삭제할 수 없다 (403)")
    void otherMemberCannotUpdateOrDelete() throws Exception {
        User a = user("wr-a2", User.Role.MEMBER);
        User b = user("wr-b2", User.Role.MEMBER);
        WeeklyReport r = report(a.getUsername(), WeeklyReport.ReportType.INDIVIDUAL);

        mvc.perform(put("/api/weekly-reports/" + r.getId()).header("Authorization", bearer(b))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/weekly-reports/" + r.getId()).header("Authorization", bearer(b)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("MANAGER 는 남의 개인 보고서를 수정할 수 있다 (200)")
    void managerCanUpdate() throws Exception {
        User a = user("wr-a3", User.Role.MEMBER);
        User m = user("wr-m3", User.Role.MANAGER);
        WeeklyReport r = report(a.getUsername(), WeeklyReport.ReportType.INDIVIDUAL);

        mvc.perform(put("/api/weekly-reports/" + r.getId()).header("Authorization", bearer(m))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("통합 보고서는 MEMBER 가 삭제할 수 없다 (403)")
    void memberCannotDeleteConsolidated() throws Exception {
        User m = user("wr-m4", User.Role.MANAGER);
        User a = user("wr-a4", User.Role.MEMBER);
        WeeklyReport c = report(m.getUsername(), WeeklyReport.ReportType.CONSOLIDATED);

        mvc.perform(delete("/api/weekly-reports/" + c.getId()).header("Authorization", bearer(a)))
                .andExpect(status().isForbidden());
    }

    private WeeklyReport report(String author, WeeklyReport.ReportType type) {
        WeeklyReport r = new WeeklyReport();
        r.setTitle("보고");
        r.setWeekStart(LocalDate.of(2026, 10, 19));
        r.setWeekEnd(LocalDate.of(2026, 10, 25));
        r.setAuthor(author);
        r.setReportType(type);
        return repository.saveAndFlush(r);
    }
}
