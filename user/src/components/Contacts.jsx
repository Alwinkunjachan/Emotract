import React, { useState, useEffect } from "react";
import styled from "styled-components";
import Logo from "../assets/logo.svg";
import fallBackImage from "../assets/avatars/avatar.png"
import Settings from "./ui/Settings";
import { allUsersRoute } from "../utils/APIRoutes";
import axiosInstance from "../utils/axiosInstance";

export default function Contacts({ contacts, changeChat, unreadMessages = {}, onlineUsers = new Set(), currentUser }) {
  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentUserImage, setCurrentUserImage] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);
  const [searchQuery, setSearchQuery] = useState(""); // Added state for search query
  const [filteredContacts, setFilteredContacts] = useState(contacts); // Filtered contacts based on search query
  const [searchContacts, setSearchContacts] = useState([]);

  useEffect(() => {
    if (currentUser) {
      setCurrentUserName(currentUser.username);
      setCurrentUserImage(currentUser.avatarImage);
    }
  }, [currentUser]);

  useEffect(() => {
    console.log("Updated contacts in Contacts component:", contacts);
  }, [contacts]);
  
  

  // Fetch all users and update searchContacts state
  useEffect(() => {
    const fetchSearchContacts = async () => {
      try {
        if (currentUser) {
          const { data } = await axiosInstance.get(`${allUsersRoute}/${currentUser._id}`);
          setSearchContacts(data);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
      }
    };
    fetchSearchContacts();
  }, [currentUser]);
  

   // Filter contacts based on the search query
   useEffect(() => {
    if (searchQuery === "") {
      setFilteredContacts(contacts); // Show all contacts when no search query
    } else {
      setFilteredContacts(
        searchContacts.filter((contact) =>
          contact.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, contacts, searchContacts]);

  const changeCurrentChat = (index, contact) => {
    setCurrentSelected(index);
    changeChat(contact);
  };


  return (
    <>
      {currentUserImage && (
        <Container>
          <div className="flex justify-between px-5 text-white items-center w-full ">
            <div className="flex items-center">
              <img src={Logo} alt="logo" />
              <h3 className="pl-1">Emotract v1</h3>
            </div>
            <Settings currentUserImage={currentUserImage} currentUserName={currentUserName} />
          </div>
          <div className="contacts">
            <div className="w-[90%] border-b border-gray-400 mt-1">
              <input
                  type="text"
                  placeholder="Search..."
                  className="placeholder:text-gray-400 w-full p-2 focus:outline-none text-white"
                  value={searchQuery} // Bind the search query
                  onChange={(e) => setSearchQuery(e.target.value)} // Update the state on input change
                />
            </div>
            {filteredContacts.length === 0 ? (
              <div className="no-results mt-5 flex flex-col justify-center items-center">
                <p className="text-orange-800">No contacts found!</p>
                {contacts.length === 0 &&
                  <p className="text-white text-lg">Search and start your first Conversation.</p>
                }
              </div>
            ) : (
              filteredContacts.map((contact, index) => {
                const lastMessageContact = contacts.find(c => c._id === contact._id);

                return (
                  <div
                    key={contact._id}
                    className={`contact ${
                      index === currentSelected ? "selected" : ""
                    } hover:bg-[#dedede34]`}
                    onClick={() => changeCurrentChat(index, contact)}
                  >
                    <div className="avatar min-w-[15%] relative">
                      <img
                        src={contact.avatarImage ? contact.avatarImage : fallBackImage}
                        className="w-12 h-12 rounded-full border-1 border-gray-400"
                        alt=""
                      />
                      {onlineUsers.has(contact._id) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#080420] rounded-full"></span>
                      )}
                    </div>
                    <div className="username flex flex-col gap-0  w-[80%]">
                      <div className="flex items-center justify-between">
                        <h3>{contact.username}</h3>
                        {unreadMessages[contact._id] > 0 && (
                          <span className="bg-green-500 text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1">
                            {unreadMessages[contact._id]}
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-sm truncate ${unreadMessages[contact._id] > 0 ? 'text-green-400 font-semibold' : 'text-gray-500'}`}>
                        {lastMessageContact?.last_message?.text || lastMessageContact?.lastMessage?.text || "No messages yet"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-between items-center pl-[0.4rem]">
          <div className="flex">
            <div className="avatar">
              <img
                style={{ mixBlendMode: "saturation" }}
                className="w-12 h-12"
                src={`${currentUserImage}`}
                alt="avatar"
              />
            </div>
            <div className="username">
              <h2 className="font-semibold text-white capitalize ml-2">{currentUserName}</h2>
              <span className="text-green-500 text-sm ml-2">Online</span>
            </div>
          </div>
          <div>
            <button>Logout</button>
          </div>
            </div>
        </Container>
      )}
    </>
  );
}
const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 90%;
  overflow: hidden;
  background-color: #080420;
  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
    img {
      height: 2rem;
    }
    h3 {
      color: white;
      text-transform: uppercase;
    }
  }
  .contacts {
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: auto;
    gap: 0.2rem;
    &::-webkit-scrollbar {
      width: 0.2rem;
      &-thumb {
        background-color: #ffffff39;
        width: 0.1rem;
        border-radius: 1rem;
      }
    }
    .contact {
      background-color: #ffffff34;
      min-height: 4rem;
      cursor: pointer;
      width: 90%;
      border-radius: 0.2rem;
      padding: 0.4rem;
      display: flex;
      gap: 1rem;
      align-items: center;
      transition: 0.5s ease-in-out;
      .username {
        h3 {
          color: white;
        }
      }
    }
    .selected {
      background-color: #1f193a;
    }
  }

  .current-user {
    background-color: #0d0d30;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 2rem;
    .avatar {
      img {
        height: 4rem;
        max-inline-size: 100%;
      }
    }
    .username {
      h2 {
        color: white;
      }
    }
    @media screen and (min-width: 720px) and (max-width: 1080px) {
      gap: 0.5rem;
      .username {
        h2 {
          font-size: 1rem;
        }
      }
    }
  }
`;
