package com.platform.portal.domain.todo.service;

import com.platform.portal.domain.todo.dto.TodoDto;
import com.platform.portal.domain.todo.entity.Todo;
import com.platform.portal.domain.todo.repository.TodoRepository;
import com.platform.portal.domain.user.service.UserLookup;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TodoService {

    private final TodoRepository repository;
    private final UserLookup userLookup;

    public List<TodoDto.Response> findMine(String username) {
        return toResponses(repository.findAllByOrderByCreatedAtDesc().stream()
                .filter(t -> isAssigneeOrCollaborator(t, username))
                .toList());
    }

    public List<TodoDto.Response> findAll() {
        return toResponses(repository.findAllByOrderByCreatedAtDesc());
    }

    @Transactional
    public TodoDto.Response create(TodoDto.SaveRequest req, String assignee) {
        Todo t = new Todo();
        t.setAssignee(assignee);
        apply(t, req);
        repository.save(t);
        return new TodoDto.Response(t, userLookup.nameOf(t.getAssignee()));
    }

    /**
     * @param assigneeOverride 관리자가 담당자를 바꿀 때만 non-null (컨트롤러가 판정, 현행 유지)
     * @param actorUsername    소유자 검사용 (F-AUTH-001 R-003)
     */
    @Transactional
    public TodoDto.Response update(Long id, TodoDto.SaveRequest req, String assigneeOverride, String actorUsername) {
        Todo t = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
        checkOwnership(t, actorUsername);
        if (assigneeOverride != null) t.setAssignee(assigneeOverride);
        apply(t, req);
        repository.save(t);
        return new TodoDto.Response(t, userLookup.nameOf(t.getAssignee()));
    }

    @Transactional
    public void delete(Long id, String actorUsername) {
        Todo t = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
        checkOwnership(t, actorUsername);
        repository.delete(t);
    }

    /** 소유자 검사 (R-003): 담당자 또는 협업자 또는 ADMIN/MANAGER */
    private void checkOwnership(Todo t, String actorUsername) {
        if (!isAssigneeOrCollaborator(t, actorUsername) && !userLookup.isAdminOrManager(actorUsername)) {
            throw new AccessDeniedException("담당자·협업자만 수정·삭제할 수 있습니다.");
        }
    }

    private boolean isAssigneeOrCollaborator(Todo t, String username) {
        return username.equals(t.getAssignee())
                || (t.getCollaborators() != null && t.getCollaborators().contains(username));
    }

    private List<TodoDto.Response> toResponses(List<Todo> todos) {
        Map<String, String> names = userLookup.namesOf(todos.stream().map(Todo::getAssignee).toList());
        return todos.stream().map(t -> new TodoDto.Response(t, names.get(t.getAssignee()))).toList();
    }

    private void apply(Todo t, TodoDto.SaveRequest req) {
        t.setTitle(req.getTitle());
        t.setDescription(req.getDescription());
        if (req.getStatus() != null) t.setStatus(req.getStatus());
        if (req.getPriority() != null) t.setPriority(req.getPriority());
        t.setStartDate(req.getStartDate());
        t.setDueDate(req.getDueDate());
        t.setCompletedDate(req.getCompletedDate());
        if (req.getSourceType() != null) t.setSourceType(req.getSourceType());
        t.setSourceId(req.getSourceId());
        t.setWorkUnitId(req.getWorkUnitId());
        if (req.getCheckItems() != null) t.setCheckItems(req.getCheckItems());
        if (req.getLinks() != null) t.setLinks(req.getLinks());
        t.setImageUrl(req.getImageUrl());
        if (req.getCollaborators() != null) t.setCollaborators(req.getCollaborators());
        if (req.getWorkLogs() != null) t.setWorkLogs(req.getWorkLogs());
    }
}
