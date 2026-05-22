package com.platform.portal.domain.report.repository;

import com.platform.portal.domain.report.entity.MeetingMinute;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MeetingMinuteRepository extends JpaRepository<MeetingMinute, Long> {
    List<MeetingMinute> findAllByOrderByMeetingDateDescCreatedAtDesc();
}
