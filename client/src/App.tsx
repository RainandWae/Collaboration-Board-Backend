import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity,
  ArrowLeftRight,
  Bell,
  Columns3,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  UserPlus,
  Wifi,
  WifiOff
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type User = {
  id: string;
  email: string;
  name: string;
};

type AuthSession = {
  token: string;
  user: User;
};

type Board = {
  id: string;
  title: string;
  lists?: List[];
  members?: BoardMember[];
};

type BoardMember = {
  role: "OWNER" | "EDITOR" | "VIEWER";
  user: User;
};

type BoardRole = BoardMember["role"];

type List = {
  id: string;
  boardId: string;
  title: string;
  position: number;
  cards: Card[];
};

type Card = {
  id: string;
  listId: string;
  title: string;
  description?: string | null;
  position: number;
  version: number;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: User;
};

type BoardActivity = {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: User;
};

type ApiError = {
  error: string;
  latestCard?: Card;
};

async function apiRequest<T>(path: string, token: string | null, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: "Request failed" }))) as ApiError;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function getStoredSession() {
  const raw = localStorage.getItem("collab-board-session");
  return raw ? (JSON.parse(raw) as AuthSession) : null;
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<BoardActivity[]>([]);
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [boardRole, setBoardRole] = useState<BoardRole | null>(null);
  const [draggingCard, setDraggingCard] = useState<Card | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const token = session?.token ?? null;
  const canEditBoard = boardRole === "OWNER" || boardRole === "EDITOR";
  const canInviteMembers = boardRole === "OWNER";

  async function loadBoards() {
    if (!token) return;
    const data = await apiRequest<{ boards: Board[] }>("/boards", token);
    setBoards(data.boards);

    if (!activeBoard && data.boards.length > 0) {
      await loadBoard(data.boards[0].id);
    }
  }

  async function loadBoard(boardId: string) {
    if (!token) return;
    const data = await apiRequest<{ board: Board; role: BoardRole }>(`/boards/${boardId}`, token);
    setActiveBoard(data.board);
    setBoardRole(data.role);
    setActiveCard(null);
    await loadActivity(boardId);
  }

  async function loadActivity(boardId: string) {
    if (!token) return;
    const data = await apiRequest<{ activities: BoardActivity[] }>(
      `/boards/${boardId}/activity?limit=20`,
      token
    );
    setActivities(data.activities);
  }

  async function loadComments(cardId: string) {
    if (!token) return;
    const data = await apiRequest<{ comments: Comment[] }>(`/cards/${cardId}/comments`, token);
    setComments(data.comments);
  }

  function openCard(card: Card) {
    setActiveCard(card);
    void loadComments(card.id);
  }

  function saveSession(nextSession: AuthSession) {
    localStorage.setItem("collab-board-session", JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function logout() {
    localStorage.removeItem("collab-board-session");
    setSession(null);
    setBoards([]);
    setActiveBoard(null);
    setActiveCard(null);
    setBoardRole(null);
  }

  function findCardLocation(cardId: string, board: Board | null = activeBoard) {
    for (const list of board?.lists ?? []) {
      const cardIndex = (list.cards ?? []).findIndex((card) => card.id === cardId);

      if (cardIndex !== -1) {
        return { list, cardIndex, card: list.cards[cardIndex] };
      }
    }

    return null;
  }

  function findList(listId: string) {
    return activeBoard?.lists?.find((list) => list.id === listId) ?? null;
  }

  function moveCardOptimistically(cardId: string, targetListId: string, targetPosition: number) {
    setActiveBoard((currentBoard) => {
      if (!currentBoard?.lists) return currentBoard;

      const sourceLocation = findCardLocation(cardId, currentBoard);
      if (!sourceLocation) return currentBoard;

      const nextLists = currentBoard.lists.map((list) => ({
        ...list,
        cards: [...(list.cards ?? [])]
      }));
      const sourceList = nextLists.find((list) => list.id === sourceLocation.list.id);
      const targetList = nextLists.find((list) => list.id === targetListId);

      if (!sourceList || !targetList) return currentBoard;

      const sourceIndex = sourceList.cards.findIndex((card) => card.id === cardId);
      if (sourceIndex === -1) return currentBoard;

      if (sourceList.id === targetList.id) {
        sourceList.cards = arrayMove(sourceList.cards, sourceIndex, targetPosition).map(
          (card, index) => ({ ...card, position: index })
        );
      } else {
        const [movedCard] = sourceList.cards.splice(sourceIndex, 1);
        targetList.cards.splice(targetPosition, 0, { ...movedCard, listId: targetListId });
        sourceList.cards = sourceList.cards.map((card, index) => ({ ...card, position: index }));
        targetList.cards = targetList.cards.map((card, index) => ({ ...card, position: index }));
      }

      return { ...currentBoard, lists: nextLists };
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const location = findCardLocation(String(event.active.id));
    setDraggingCard(location?.card ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingCard(null);

    if (!token || !activeBoard || !canEditBoard || !event.over) return;

    const cardId = String(event.active.id);
    const sourceLocation = findCardLocation(cardId);
    if (!sourceLocation) return;

    const overId = String(event.over.id);
    const overCardLocation = findCardLocation(overId);
    const overList = overCardLocation?.list ?? findList(overId);
    if (!overList) return;

    const targetListId = overList.id;
    const targetPosition = overCardLocation
      ? overCardLocation.cardIndex
      : (overList.cards?.length ?? 0);

    if (sourceLocation.list.id === targetListId && sourceLocation.cardIndex === targetPosition) {
      return;
    }

    moveCardOptimistically(cardId, targetListId, targetPosition);

    try {
      await apiRequest(`/cards/${cardId}/move`, token, {
        method: "PATCH",
        body: JSON.stringify({
          targetListId,
          position: targetPosition,
          version: sourceLocation.card.version
        })
      });
      await loadBoard(activeBoard.id);
    } catch (err) {
      const error = err as ApiError;
      setNotice(
        error.latestCard ? `Conflict: latest version is ${error.latestCard.version}` : error.error
      );
      await loadBoard(activeBoard.id);
    }
  }

  useEffect(() => {
    if (token) {
      void loadBoards();
    }
  }, [token]);

  useEffect(() => {
    if (!token || !activeBoard) return;

    const socket: Socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"]
    });

    const refreshBoard = () => {
      void loadBoard(activeBoard.id);
    };

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("board:join", { boardId: activeBoard.id });
    });

    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("list:created", refreshBoard);
    socket.on("list:updated", refreshBoard);
    socket.on("list:deleted", refreshBoard);
    socket.on("card:created", refreshBoard);
    socket.on("card:updated", refreshBoard);
    socket.on("card:deleted", refreshBoard);
    socket.on("card:moved", refreshBoard);
    socket.on("comment:created", ({ cardId }: { cardId: string }) => {
      if (activeCard?.id === cardId) {
        void loadComments(cardId);
      }
      refreshBoard();
    });

    return () => {
      socket.disconnect();
    };
  }, [token, activeBoard?.id, activeCard?.id]);

  const lists = useMemo(() => activeBoard?.lists ?? [], [activeBoard]);

  if (!session) {
    return <AuthScreen onAuth={saveSession} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Columns3 size={24} />
          <div>
            <strong>Collab Board</strong>
            <span>{session.user.name}</span>
          </div>
        </div>

        <CreateBoardForm token={token} onCreated={loadBoards} />

        <nav className="board-nav" aria-label="Boards">
          {boards.map((board) => (
            <button
              key={board.id}
              className={board.id === activeBoard?.id ? "active" : ""}
              onClick={() => void loadBoard(board.id)}
            >
              {board.title}
            </button>
          ))}
        </nav>

        <button className="ghost-button" onClick={logout}>
          <LogOut size={16} />
          Sign out
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{activeBoard?.title ?? "Boards"}</h1>
            <p>
              {activeBoard
                ? `${lists.length} lists - ${boardRole?.toLowerCase() ?? "member"}`
                : "Create or select a board"}
            </p>
          </div>
          <div className="topbar-actions">
            <span className={socketConnected ? "status online" : "status offline"}>
              {socketConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
              {socketConnected ? "Live" : "Offline"}
            </span>
            <button
              disabled={!activeBoard}
              onClick={() => activeBoard && void loadBoard(activeBoard.id)}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}

        {activeBoard ? (
          <>
            <section className="utility-row">
              {canEditBoard && (
                <CreateListForm
                  board={activeBoard}
                  token={token}
                  onCreated={() => loadBoard(activeBoard.id)}
                />
              )}
              <SearchPanel token={token} onResults={setSearchResults} />
            </section>

            <section className="member-row">
              <MemberSummary members={activeBoard.members ?? []} role={boardRole} />
              {canInviteMembers && (
                <InviteMemberForm
                  board={activeBoard}
                  token={token}
                  onInvited={() => loadBoard(activeBoard.id)}
                  onError={setNotice}
                />
              )}
            </section>

            {searchResults.length > 0 && (
              <section className="search-results">
                <div className="section-title">
                  <Search size={16} />
                  Search results
                </div>
                {searchResults.map((card) => (
                  <button key={card.id} onClick={() => openCard(card)}>
                    {card.title}
                  </button>
                ))}
              </section>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setDraggingCard(null)}
            >
              <section className="board-canvas">
                {lists.map((list) => (
                  <BoardList
                    key={list.id}
                    list={list}
                    canEdit={canEditBoard}
                    token={token}
                    onCardOpen={openCard}
                    onCardCreated={() => loadBoard(activeBoard.id)}
                    onError={setNotice}
                  />
                ))}
              </section>
              <DragOverlay>
                {draggingCard ? <CardPreview card={draggingCard} isOverlay /> : null}
              </DragOverlay>
            </DndContext>
          </>
        ) : (
          <section className="empty-state">
            <Columns3 size={40} />
            <h2>No board selected</h2>
          </section>
        )}
      </main>

      <aside className="detail-pane">
        {activeCard ? (
          <CardDetails
            card={activeCard}
            comments={comments}
            lists={lists}
            token={token}
            onClose={() => setActiveCard(null)}
            onChanged={() => activeBoard && loadBoard(activeBoard.id)}
            onConflict={(message) => setNotice(message)}
            canEdit={canEditBoard}
          />
        ) : (
          <ActivityFeed activities={activities} />
        )}
      </aside>
    </div>
  );
}

function BoardList({
  list,
  canEdit,
  token,
  onCardOpen,
  onCardCreated,
  onError
}: {
  list: List;
  canEdit: boolean;
  token: string | null;
  onCardOpen: (card: Card) => void;
  onCardCreated: () => void;
  onError: (message: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
    disabled: !canEdit
  });

  return (
    <article className={isOver ? "list-panel drop-target" : "list-panel"} ref={setNodeRef}>
      <div className="list-header">
        <strong>{list.title}</strong>
        <span>{list.cards?.length ?? 0}</span>
      </div>

      {canEdit && (
        <CreateCardForm list={list} token={token} onCreated={onCardCreated} onError={onError} />
      )}

      <SortableContext
        items={(list.cards ?? []).map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="cards">
          {(list.cards ?? []).map((card) => (
            <SortableCard key={card.id} card={card} canEdit={canEdit} onCardOpen={onCardOpen} />
          ))}
        </div>
      </SortableContext>
    </article>
  );
}

function SortableCard({
  card,
  canEdit,
  onCardOpen
}: {
  card: Card;
  canEdit: boolean;
  onCardOpen: (card: Card) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !canEdit
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <button
      ref={setNodeRef}
      className={isDragging ? "card-item dragging" : "card-item"}
      style={style}
      onClick={() => onCardOpen(card)}
      {...attributes}
      {...listeners}
    >
      <CardPreview card={card} />
    </button>
  );
}

function CardPreview({ card, isOverlay = false }: { card: Card; isOverlay?: boolean }) {
  return (
    <div className={isOverlay ? "card-preview overlay" : "card-preview"}>
      <strong>{card.title}</strong>
      {card.description && <span>{card.description}</span>}
      <small>v{card.version}</small>
    </div>
  );
}

function AuthScreen({ onAuth }: { onAuth: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("Owner");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const session = await apiRequest<AuthSession>(path, null, {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          ...(mode === "register" ? { name } : {})
        })
      });

      onAuth(session);
    } catch (err) {
      setError((err as ApiError).error ?? "Authentication failed");
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="brand auth-brand">
          <Columns3 size={28} />
          <div>
            <strong>Collaboration Board</strong>
            <span>Realtime project workspace</span>
          </div>
        </div>

        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit} className="form-stack">
          {mode === "register" && (
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input
              value={password}
              type="password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit">{mode === "login" ? "Login" : "Create account"}</button>
        </form>
      </section>
    </main>
  );
}

function CreateBoardForm({ token, onCreated }: { token: string | null; onCreated: () => void }) {
  const [title, setTitle] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await apiRequest("/boards", token, {
      method: "POST",
      body: JSON.stringify({ title })
    });
    setTitle("");
    onCreated();
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input
        placeholder="New board"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button title="Create board" aria-label="Create board">
        <Plus size={16} />
      </button>
    </form>
  );
}

function CreateListForm({
  board,
  token,
  onCreated
}: {
  board: Board;
  token: string | null;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await apiRequest(`/boards/${board.id}/lists`, token, {
      method: "POST",
      body: JSON.stringify({ title })
    });
    setTitle("");
    onCreated();
  }

  return (
    <form className="inline-form wide" onSubmit={submit}>
      <input
        placeholder="Add list"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button>
        <Plus size={16} />
        List
      </button>
    </form>
  );
}

function CreateCardForm({
  list,
  token,
  onCreated,
  onError
}: {
  list: List;
  token: string | null;
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    try {
      await apiRequest(`/lists/${list.id}/cards`, token, {
        method: "POST",
        body: JSON.stringify({ title })
      });
      setTitle("");
      onCreated();
    } catch (err) {
      onError((err as ApiError).error ?? "Could not create card");
    }
  }

  return (
    <form className="card-create" onSubmit={submit}>
      <input
        placeholder="Add card"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button aria-label="Add card">
        <Plus size={15} />
      </button>
    </form>
  );
}

function SearchPanel({
  token,
  onResults
}: {
  token: string | null;
  onResults: (cards: Card[]) => void;
}) {
  const [query, setQuery] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) {
      onResults([]);
      return;
    }
    const data = await apiRequest<{ cards: Card[] }>(
      `/search/cards?q=${encodeURIComponent(query)}&limit=10`,
      token
    );
    onResults(data.cards);
  }

  return (
    <form className="inline-form wide" onSubmit={submit}>
      <input
        placeholder="Search cards"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <button>
        <Search size={16} />
        Search
      </button>
    </form>
  );
}

function MemberSummary({ members, role }: { members: BoardMember[]; role: BoardRole | null }) {
  return (
    <div className="member-summary">
      <div className="section-title compact">
        <Shield size={16} />
        Members
      </div>
      <div className="member-pills">
        {members.map((member) => (
          <span key={member.user.id} title={member.user.email}>
            {member.user.name}
            <small>{member.role.toLowerCase()}</small>
          </span>
        ))}
      </div>
      {role === "VIEWER" && <p>Viewer access is read-only.</p>}
    </div>
  );
}

function InviteMemberForm({
  board,
  token,
  onInvited,
  onError
}: {
  board: Board;
  token: string | null;
  onInvited: () => void;
  onError: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("VIEWER");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    try {
      await apiRequest(`/boards/${board.id}/members`, token, {
        method: "POST",
        body: JSON.stringify({ email, role })
      });
      setEmail("");
      setRole("VIEWER");
      onInvited();
    } catch (err) {
      onError((err as ApiError).error ?? "Could not invite member");
    }
  }

  return (
    <form className="invite-form" onSubmit={submit}>
      <input
        placeholder="Member email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <select value={role} onChange={(event) => setRole(event.target.value as "EDITOR" | "VIEWER")}>
        <option value="VIEWER">Viewer</option>
        <option value="EDITOR">Editor</option>
      </select>
      <button>
        <UserPlus size={16} />
        Invite
      </button>
    </form>
  );
}

function CardDetails({
  card,
  comments,
  lists,
  token,
  onClose,
  onChanged,
  onConflict,
  canEdit
}: {
  card: Card;
  comments: Comment[];
  lists: List[];
  token: string | null;
  onClose: () => void;
  onChanged: () => void;
  onConflict: (message: string) => void;
  canEdit: boolean;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [comment, setComment] = useState("");
  const [targetListId, setTargetListId] = useState(card.listId);

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description ?? "");
    setTargetListId(card.listId);
  }, [card.id, card.title, card.description, card.listId]);

  async function updateCard(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(`/cards/${card.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          description,
          version: card.version
        })
      });
      onChanged();
    } catch (err) {
      const error = err as ApiError;
      onConflict(
        error.latestCard ? `Conflict: latest version is ${error.latestCard.version}` : error.error
      );
    }
  }

  async function moveCard() {
    try {
      await apiRequest(`/cards/${card.id}/move`, token, {
        method: "PATCH",
        body: JSON.stringify({
          targetListId,
          position: 0,
          version: card.version
        })
      });
      onChanged();
    } catch (err) {
      const error = err as ApiError;
      onConflict(
        error.latestCard ? `Conflict: latest version is ${error.latestCard.version}` : error.error
      );
    }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    await apiRequest(`/cards/${card.id}/comments`, token, {
      method: "POST",
      body: JSON.stringify({ body: comment })
    });
    setComment("");
    onChanged();
  }

  return (
    <section className="card-detail">
      <div className="detail-header">
        <div>
          <strong>Card</strong>
          <span>v{card.version}</span>
        </div>
        <button onClick={onClose}>Close</button>
      </div>

      {canEdit ? (
        <>
          <form className="form-stack" onSubmit={updateCard}>
            <label>
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <button type="submit">
              <Send size={16} />
              Save
            </button>
          </form>

          <div className="move-control">
            <div className="section-title">
              <ArrowLeftRight size={16} />
              Move
            </div>
            <select value={targetListId} onChange={(event) => setTargetListId(event.target.value)}>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
            <button onClick={moveCard}>Move to top</button>
          </div>
        </>
      ) : (
        <div className="readonly-card">
          <strong>{card.title}</strong>
          <p>{card.description || "No description"}</p>
        </div>
      )}

      <div className="comments">
        <div className="section-title">
          <MessageSquare size={16} />
          Comments
        </div>
        {comments.map((item) => (
          <div className="comment" key={item.id}>
            <strong>{item.author.name}</strong>
            <p>{item.body}</p>
          </div>
        ))}
        {canEdit ? (
          <form className="comment-form" onSubmit={addComment}>
            <input
              placeholder="Comment with @user@example.com"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <button>
              <Send size={16} />
            </button>
          </form>
        ) : (
          <p className="readonly-note">Viewer access can read comments only.</p>
        )}
      </div>
    </section>
  );
}

function ActivityFeed({ activities }: { activities: BoardActivity[] }) {
  return (
    <section className="activity-feed">
      <div className="section-title">
        <Activity size={16} />
        Activity
      </div>
      {activities.length === 0 && (
        <div className="empty-mini">
          <Bell size={18} />
          No activity yet
        </div>
      )}
      {activities.map((item) => (
        <div className="activity-item" key={item.id}>
          <strong>{item.action.replaceAll("_", " ").toLowerCase()}</strong>
          <span>{item.actor.name}</span>
          <small>{new Date(item.createdAt).toLocaleString()}</small>
        </div>
      ))}
    </section>
  );
}

export default App;
