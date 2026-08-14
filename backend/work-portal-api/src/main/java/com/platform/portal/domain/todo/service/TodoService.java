package com.platform.portal.domain.todo.service;

import com.platform.portal.domain.todo.dto.TodoDto;
import com.platform.portal.domain.todo.entity.Todo;
import com.platform.portal.domain.todo.repository.TodoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TodoService {

    private final TodoRepository repository;

    public List<TodoDto.Response> findMine(String username) {
        return repository.findByAssigneeOrderByCreatedAtDesc(username)
                .stream().map(TodoDto.Response::new).toList();
    }

    public List<TodoDto.Response> findAll() {
        return repository.findAllByOrderByCreatedAtDesc()
                .stream().map(TodoDto.Response::new).toList();
    }

    @Transactional
    public TodoDto.Response create(TodoDto.SaveRequest req, String assignee) {
        Todo t = new Todo();
        t.setAssignee(assignee);
        apply(t, req);
        return new TodoDto.Response(repository.save(t));
    }

    @Transactional
    public TodoDto.Response update(Long id, TodoDto.SaveRequest req, String assignee) {
        Todo t = repository.findById(id).orElseThrow();
        if (assignee != null) t.setAssignee(assignee);
        apply(t, req);
        return new TodoDto.Response(repository.save(t));
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private void apply(Todo t, TodoDto.SaveRequest req) {
        t.setTitle(req.getTitle());
        t.setDescription(req.getDescription());
        if (req.getStatus() != null) t.setStatus(req.getStatus());
        if (req.getPriority() != null) t.setPriority(req.getPriority());
        t.setStartDate(req.getStartDate());
        t.setDueDate(req.getDueDate());
        if (req.getSourceType() != null) t.setSourceType(req.getSourceType());
        t.setSourceId(req.getSourceId());
        t.setKeyTaskId(req.getKeyTaskId());
        t.setWorkUnitId(req.getWorkUnitId());
    }
}
