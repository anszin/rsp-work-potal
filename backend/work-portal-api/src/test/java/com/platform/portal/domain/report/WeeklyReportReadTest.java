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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** F-AUTH-001 R-009 — 개인 주간보고 단건 조회 소유자 검사. 현행: id 만 알면 누구나 조회(200). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class WeeklyReportReadTest extends AuthTestSupport {

    @Autowired MockMvc mvc;
    @Autowired WeeklyReportRepository repository;

    @Test
    @DisplayName("다른 MEMBER 는 남의 개인 보고서를 단건 조회할 수 없다 (403)")
    void otherMemberCannotRead() throws Exception {
        User a = user("rd-a", User.Role.MEMBER);
        User b = user("rd-b", User.Role.MEMBER);
        WeeklyReport r = report(a.getUsername(), WeeklyReport.ReportType.INDIVIDUAL);

        mvc.perform(get("/api/weekly-reports/" + r.getId()).header("Authorization", bearer(b)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("작성자 본인과 MANAGER 는 조회할 수 있다 (200)")
    void ownerAndManagerCanRead() throws Exception {
        User a = user("rd-a2", User.Role.MEMBER);
        User m = user("rd-m2", User.Role.MANAGER);
        WeeklyReport r = report(a.getUsername(), WeeklyReport.ReportType.INDIVIDUAL);

        mvc.perform(get("/api/weekly-reports/" + r.getId()).header("Authorization", bearer(a))).andExpect(status().isOk());
        mvc.perform(get("/api/weekly-reports/" + r.getId()).header("Authorization", bearer(m))).andExpect(status().isOk());
    }

    @Test
    @DisplayName("통합 보고서는 MEMBER 도 조회할 수 있다 (200, 현행 유지)")
    void consolidatedReadableByMember() throws Exception {
        User m = user("rd-m3", User.Role.MANAGER);
        User a = user("rd-a3", User.Role.MEMBER);
        WeeklyReport c = report(m.getUsername(), WeeklyReport.ReportType.CONSOLIDATED);

        mvc.perform(get("/api/weekly-reports/" + c.getId()).header("Authorization", bearer(a))).andExpect(status().isOk());
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
