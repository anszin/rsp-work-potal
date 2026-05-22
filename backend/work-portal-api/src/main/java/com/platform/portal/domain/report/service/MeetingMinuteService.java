package com.platform.portal.domain.report.service;

import com.platform.portal.domain.report.dto.MeetingMinuteDto;
import com.platform.portal.domain.report.entity.MeetingMinute;
import com.platform.portal.domain.report.repository.MeetingMinuteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MeetingMinuteService {

    private final MeetingMinuteRepository repository;

    public List<MeetingMinuteDto.Response> findAll() {
        return repository.findAllByOrderByMeetingDateDescCreatedAtDesc().stream()
                .map(MeetingMinuteDto.Response::new).toList();
    }

    public MeetingMinuteDto.Response findById(Long id) {
        return repository.findById(id)
                .map(MeetingMinuteDto.Response::new)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
    }

    @Transactional
    public MeetingMinuteDto.Response create(MeetingMinuteDto.SaveRequest req, String author) {
        MeetingMinute m = new MeetingMinute();
        apply(m, req);
        m.setAuthor(author);
        return new MeetingMinuteDto.Response(repository.save(m));
    }

    @Transactional
    public MeetingMinuteDto.Response update(Long id, MeetingMinuteDto.SaveRequest req) {
        MeetingMinute m = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
        apply(m, req);
        return new MeetingMinuteDto.Response(m);
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
