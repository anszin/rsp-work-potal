package com.platform.portal.service;

import com.platform.portal.domain.report.entity.WeeklyReport;
import com.platform.portal.domain.report.repository.WeeklyReportRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class WeeklyReportReminderScheduler {

    private final WeeklyReportRepository weeklyReportRepository;
    private final UserRepository userRepository;
    private final WebexService webexService;

    @Value("${app.site-url:https://rsp-work-potal.vercel.app}")
    private String siteUrl;

    // 매주 금요일 오전 9시 (서버 시간 기준, KST)
    @Scheduled(cron = "0 0 9 * * FRI", zone = "Asia/Seoul")
    public void sendWeeklyReportReminder() {
        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(DayOfWeek.MONDAY);

        Set<String> submitted = weeklyReportRepository
                .findByWeekStartAndReportTypeOrderByCreatedAtDesc(monday, WeeklyReport.ReportType.INDIVIDUAL)
                .stream()
                .map(WeeklyReport::getAuthor)
                .collect(Collectors.toSet());

        List<User> notSubmitted = userRepository.findAll().stream()
                .filter(u -> u.isActive()
                        && u.getRole() != User.Role.EXTERNAL
                        && u.getEmail() != null
                        && !u.getEmail().isBlank()
                        && !submitted.contains(u.getUsername()))
                .toList();

        if (notSubmitted.isEmpty()) {
            log.info("주간보고 리마인더: 전원 제출 완료");
            return;
        }

        log.info("주간보고 리마인더 발송: {}명 미제출", notSubmitted.size());
        for (User user : notSubmitted) {
            String name = user.getName() != null ? user.getName() : user.getUsername();
            String msg = "🔔 **" + name + "님**, 이번 주 주간보고가 아직 등록되지 않았습니다.\n"
                    + "> 오늘 중으로 등록 부탁드립니다.\n"
                    + "> [📋 주간보고 작성하기](" + siteUrl + "/reports/weekly)";
            webexService.sendDirectMessage(user.getEmail(), msg);
        }
    }
}
