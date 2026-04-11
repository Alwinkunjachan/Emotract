import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

  useEffect(() => {
    const checkUser = async () => {
      const storedData = localStorage.getItem(import.meta.env.VITE_LOCALHOST_KEY);
      
      if (!storedData) {
        navigate("/login");
      } else {
        try {
          const parsedData = JSON.parse(storedData);
          setCurrentUser(parsedData);
        } catch (error) {
          console.error("Error parsing localStorage data:", error);
          navigate("/login"); // Handle potential corruption by redirecting to login
        }
      }
    };
  
    checkUser();
  }, [navigate]);

  // Connect socket when user is authenticated
  useEffect(() => {
    if (currentUser) {
      connect();
    }
  }, [currentUser, connect]);

  // Register user on socket once connected
  useEffect(() => {
    if (socket && currentUser) {
      socket.emit("add-user", currentUser._id);
    }
  }, [socket, currentUser]);

  useEffect(() => {
    const fetchContacts = async () => {
      if (currentUser) {
        if (currentUser.isAvatarImageSet) {
          try {
            const { data } = await axiosInstance.get(`${allContactUsersRoute}/${currentUser._id}`);
            setContacts(data);
            // Populate lastSeenMap from DB data for users who are offline
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
            console.error("Error fetching contacts:", error);
          }
        }
      }
  
    fetchContacts();
    fetchUserBlockStatus();
  }, [currentUser, navigate]);

  // Keep ref in sync with currentChat so socket listener can access latest value
  useEffect(() => {
    currentChatRef.current = currentChat;
    // Persist selected chat across page refresh
    if (currentChat) {
      sessionStorage.setItem("currentChat", JSON.stringify(currentChat));
    } else {
      sessionStorage.removeItem("currentChat");
    }
  }, [currentChat]);

  // Listen for incoming messages at the parent level
  useEffect(() => {
    if (!socket) return;

    const handleMessageReceive = (data) => {
      const activeChat = currentChatRef.current;

      // Set arrival message for ChatContainer to pick up
      setArrivalMessage({ fromSelf: false, message: data.msg, from: data.from });

      // Update the contact's last message preview in the sidebar
      const last_message = {
        text: data.msg,
        sender_id: data.from,
        sent_at: new Date(),
      };

      setContacts((prevContacts) => {
        const contactExists = prevContacts.some(c => c._id === data.from);
        if (contactExists) {
          return prevContacts.map(c =>
            c._id === data.from ? { ...c, last_message } : c
          );
        }
        return prevContacts;
      });

      // If the message is NOT from the user we're currently chatting with, mark as unread
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
      // Store lastSeen timestamp when a user goes offline
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

  // Handle new contact after message
  const handleContactAfterMessage = useCallback(
    (updatedContact) => {
      setContacts((prevContacts) => {
        const isContactExist = prevContacts.some(contact => contact._id === updatedContact._id);

        if (isContactExist) {
          // Update existing contact's last_message
          return [...prevContacts.map(contact =>
            contact._id === updatedContact._id
              ? { ...contact, last_message: updatedContact.last_message }
              : contact
          )]; // ✅ Return a NEW array to trigger re-render
        } else {
          // Add new contact with last_message
          return [...prevContacts, updatedContact]; // ✅ Spread operator forces a new reference
        }
      });
    },
    [setContacts]
  );


  const handleChatChange = (chat) => {
    setCurrentChat(chat);
    // Clear unread count when opening a chat
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
          <Contacts contacts={contacts} changeChat={handleChatChange} unreadMessages={unreadMessages} onlineUsers={onlineUsers} />
          {currentChat === undefined ? (
            <Welcome />
          ) : (
            <ChatContainer currentChat={currentChat} handleContactAfterMessage={handleContactAfterMessage} arrivalMessage={arrivalMessage} onlineUsers={onlineUsers} lastSeenMap={lastSeenMap} />
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
