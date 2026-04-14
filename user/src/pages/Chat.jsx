import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import styled from "styled-components";
import { allContactUsersRoute, userBlockRoute } from "../utils/APIRoutes";
import ChatContainer from "../components/ChatContainer";
import Contacts from "../components/Contacts";
import Welcome from "../components/Welcome";
import axiosInstance from "../utils/axiosInstance";
import { useSocket, useSocketActions } from "../context/SocketProvider";
import SuspendedUserPopup from "../components/SuspendedUserPopup";

export default function Chat() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const socket = useSocket();
  const { connect } = useSocketActions();
  const [contacts, setContacts] = useState([]);
  const [currentChat, setCurrentChat] = useState(() => {
    const saved = sessionStorage.getItem("currentChat");
    return saved ? JSON.parse(saved) : undefined;
  });
  const currentChatRef = useRef(currentChat);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [userBlockStatus, setUserBlockStatus] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastSeenMap, setLastSeenMap] = useState({});

  // Fetch current user profile from backend /me endpoint
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!isAuthenticated) return;

      try {
        const { data } = await axiosInstance.get("/auth/me");
        if (data.status && data.user) {
          if (!data.user.is_profile_complete) {
            navigate("/complete-profile");
            return;
          }
          setCurrentUser(data.user);
        } else {
          navigate("/complete-profile");
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
        // 404 = user exists in Auth0 but not in local DB yet
        // 401 = token invalid, need to re-login
        if (error.response?.status === 401) {
          navigate("/login");
        } else {
          navigate("/complete-profile");
        }
      }
    };

    fetchCurrentUser();
  }, [isAuthenticated, navigate]);

  // Connect socket once when user is loaded
  const hasConnected = useRef(false);
  useEffect(() => {
    if (currentUser && !hasConnected.current) {
      hasConnected.current = true;
      connect();
    }
  }, [currentUser, connect]);

  // Socket events are auto-registered on connection (server uses socket.userId)
  // No need to emit add-user — the server handles it in the connection handler

  useEffect(() => {
    const fetchContacts = async () => {
      if (currentUser) {
        if (currentUser.isAvatarImageSet) {
          try {
            const { data } = await axiosInstance.get(`${allContactUsersRoute}/${currentUser._id}`);
            setContacts(data);
            const initialLastSeen = {};
            data.forEach((contact) => {
              if (contact.last_active) {
                initialLastSeen[contact._id] = contact.last_active;
              }
            });
            setLastSeenMap(initialLastSeen);
          } catch (error) {
            console.error("Error fetching contacts:", error);
          }
        } else {
          navigate("/setAvatar");
        }
      }
    };

    const fetchUserBlockStatus = async () => {
        if (currentUser) {
          try {
            const { data } = await axiosInstance.get(`${userBlockRoute}/${currentUser?._id}`);
            setUserBlockStatus(data?.is_blocked);
          } catch (error) {
            console.error("Error fetching block status:", error);
          }
        }
      }

    fetchContacts();
    fetchUserBlockStatus();
  }, [currentUser, navigate]);

  // Keep ref in sync with currentChat so socket listener can access latest value
  useEffect(() => {
    currentChatRef.current = currentChat;
    if (currentChat) {
      sessionStorage.setItem("currentChat", JSON.stringify(currentChat));
    } else {
      sessionStorage.removeItem("currentChat");
    }
  }, [currentChat]);

  // Keep a ref to contacts so the socket handler can access the latest list
  const contactsRef = useRef(contacts);
  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  // Listen for incoming messages at the parent level
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleMessageReceive = (data) => {
      const activeChat = currentChatRef.current;

      setArrivalMessage({ fromSelf: false, message: data.msg, from: data.from });

      const last_message = {
        text: data.msg,
        sender_id: data.from,
        sent_at: new Date(),
      };

      const contactExists = contactsRef.current.some(c => c._id === data.from);

      if (contactExists) {
        // Update existing contact's last message
        setContacts((prevContacts) =>
          prevContacts.map(c =>
            c._id === data.from ? { ...c, last_message } : c
          )
        );
      } else {
        // New unknown sender — fetch their info and add to contacts
        axiosInstance.get(`/auth/all-users/${currentUser._id}`).then(({ data: allUsers }) => {
          const newContact = allUsers.find(u => u._id === data.from);
          if (newContact) {
            setContacts((prev) => {
              if (prev.some(c => c._id === data.from)) return prev;
              return [...prev, {
                ...newContact,
                lastMessage: { text: last_message.text, sender: "Them", sentAt: last_message.sent_at },
              }];
            });
          }
        }).catch(err => console.error("Error fetching new contact:", err));
      }

      // Mark as unread if not the active chat
      if (!activeChat || activeChat._id !== data.from) {
        setUnreadMessages((prev) => ({
          ...prev,
          [data.from]: (prev[data.from] || 0) + 1,
        }));
      }
    };

    socket.on("msg-recieve", handleMessageReceive);

    return () => {
      socket.off("msg-recieve", handleMessageReceive);
    };
  }, [socket]);

  // Listen for online/offline status changes
  useEffect(() => {
    if (!socket) return;

    const handleOnlineUsers = (userIds) => {
      setOnlineUsers(new Set(userIds));
    };

    const handleUserStatusChange = ({ userId, isOnline, lastSeen }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
      if (!isOnline && lastSeen) {
        setLastSeenMap((prev) => ({ ...prev, [userId]: lastSeen }));
      }
    };

    socket.on("online-users", handleOnlineUsers);
    socket.on("user-status-change", handleUserStatusChange);

    return () => {
      socket.off("online-users", handleOnlineUsers);
      socket.off("user-status-change", handleUserStatusChange);
    };
  }, [socket]);

  const handleContactAfterMessage = useCallback(
    (updatedContact) => {
      setContacts((prevContacts) => {
        const isContactExist = prevContacts.some(contact => contact._id === updatedContact._id);

        if (isContactExist) {
          return [...prevContacts.map(contact =>
            contact._id === updatedContact._id
              ? { ...contact, last_message: updatedContact.last_message }
              : contact
          )];
        } else {
          return [...prevContacts, updatedContact];
        }
      });
    },
    [setContacts]
  );

  const handleChatChange = (chat) => {
    setCurrentChat(chat);
    if (chat) {
      setUnreadMessages((prev) => {
        const updated = { ...prev };
        delete updated[chat._id];
        return updated;
      });
    }
  };

  return (
    <>
      <Container>
        <div className="chat-wrapper">
          <SuspendedUserPopup isSuspended={userBlockStatus}/>
          <Contacts contacts={contacts} changeChat={handleChatChange} unreadMessages={unreadMessages} onlineUsers={onlineUsers} currentUser={currentUser} />
          {currentChat === undefined ? (
            <Welcome currentUser={currentUser} />
          ) : (
            <ChatContainer currentChat={currentChat} currentUser={currentUser} handleContactAfterMessage={handleContactAfterMessage} arrivalMessage={arrivalMessage} onlineUsers={onlineUsers} lastSeenMap={lastSeenMap} />
          )}
        </div>
      </Container>
    </>
  );
}

const Container = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  align-items: center;
  background-color: #131324;
  .chat-wrapper {
    height: 100vh;
    width: 100vw;
    background-color: #00000076;
    display: grid;
    grid-template-columns: 25% 75%;
    @media screen and (min-width: 720px) and (max-width: 1080px) {
      grid-template-columns: 35% 65%;
    }
  }
`;
