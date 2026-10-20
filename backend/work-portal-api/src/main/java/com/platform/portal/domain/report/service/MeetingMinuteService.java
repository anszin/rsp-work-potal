package com.platform.portal.domain.report.service;

import com.platform.portal.domain.report.dto.MeetingMinuteDto;
import com.platform.portal.domain.report.entity.MeetingMinute;
import com.platform.portal.domain.report.repository.MeetingMinuteRepository;
import com.platform.portal.domain.user.service.UserLookup;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/** 회의록 — 소유자 검사 없음 (L1 ① 예외: 참석자 공동 편집). 이름 매핑만 (R-008) */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MeetingMinuteService {

    private final MeetingMinuteRepository repository;
    private final UserLookup userLookup;

    public List<MeetingMinuteDto.Response> findAll() {
        List<MeetingMinute> minutes = repository.findAllByOrderByMeetingDateDescCreatedAtDesc();
        Map<String, String> names = userLookup.namesOf(minutes.stream().map(MeetingMinute::getAuthor).toList());
        return minutes.stream().map(m -> new MeetingMinuteDto.Response(m, names.get(m.getAuthor()))).toList();
    }

    public MeetingMinuteDto.Response findById(Long id) {
        MeetingMinute m = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
        return new MeetingMinuteDto.Response(m, userLookup.nameOf(m.getAuthor()));
    }

    @Transactional
    public MeetingMinuteDto.Response create(MeetingMinuteDto.SaveRequest req, String author) {
        MeetingMinute m = new MeetingMinute();
        apply(m, req);
        m.setAuthor(author);
        repository.save(m);
        return new MeetingMinuteDto.Response(m, userLookup.nameOf(author));
    }

    @Transactional
    public MeetingMinuteDto.Response update(Long id, MeetingMinuteDto.SaveRequest req) {
        MeetingMinute m = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
        apply(m, req);
        return new MeetingMinuteDto.Response(m, userLookup.nameOf(m.getAuthor()));
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private void apply(MeetingMinute m, MeetingMinuteDto.SaveRequest req) {
        m.setTitle(req.getTitle());
        m.setMeetingDate(req.getMeetingDate());
        m.setLocation(req.getLocation());
        m.setAttendees(req.getAttendees());
        m.setContent(req.getContent());
        m.setActionItems(req.getActionItems());
    }
}
