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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** F-AUTH-001 R-008 — 보고류 응답에 작성자 이름 매핑. 현행: authorName 필드 없음. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class ReportAuthorNameTest extends AuthTestSupport {

    @Autowired MockMvc mvc;
    @Autowired WeeklyReportRepository repository;

    @Test
    @DisplayName("주간보고 목록에 작성자 이름이 함께 온다")
    void authorNameIsMapped() throws Exception {
        User n = user("an-n1", User.Role.MEMBER, "홍길동", false);
        report(n.getUsername());

        mvc.perform(get("/api/weekly-reports").header("Authorization", bearer("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.author=='an-n1')].authorName").value("홍길동"));
    }

    @Test
    @DisplayName("삭제된 사용자의 보고는 authorName 이 null 이고 author 는 남는다")
    void missingUserGivesNullName() throws Exception {
        report("ghost-user");

        mvc.perform(get("/api/weekly-reports").header("Authorization", bearer("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.author=='ghost-user')].author").value("ghost-user"))
                // 필터 경로 결과는 [null] — 단일 원소는 언래핑되어 null 과 비교됨
                .andExpect(jsonPath("$[?(@.author=='ghost-user')].authorName").value((Object) null));
    }

    private void report(String author) {
        WeeklyReport r = new WeeklyReport();
        r.setTitle("보고");
        r.setWeekStart(LocalDate.of(2026, 10, 19));
        r.setWeekEnd(LocalDate.of(2026, 10, 25));
        r.setAuthor(author);
        r.setReportType(WeeklyReport.ReportType.INDIVIDUAL);
        repository.saveAndFlush(r);
    }
}
