import { useState, useEffect } from "react";
import axiosInstance from "../utils/axiosInstance";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Logo from "../assets/logo.svg";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { completeProfileRoute } from "../utils/APIRoutes";

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth0();
  const toastOptions = {
    position: "bottom-right",
    autoClose: 8000,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };

  const [values, setValues] = useState({
    firstname: "",
    lastname: "",
    phone: "",
    aadhaar_number: "",
    parent_email: "",
    age: "",
    gender: "M",
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Pre-fill from existing profile if available
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await axiosInstance.get("/auth/me");
        if (data.status && data.user) {
          const u = data.user;
          // If profile is already complete, go to chat
          if (u.is_profile_complete) {
            navigate("/");
            return;
          }
          // Pre-fill any existing values
          setValues((prev) => ({
            ...prev,
            firstname: u.firstname || prev.firstname,
            lastname: u.lastname || prev.lastname,
          }));
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "age") {
      const dob = new Date(value);
      if (isNaN(dob.getTime())) return;

      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      setValues((prevValues) => ({ ...prevValues, [name]: age }));
    } else {
      setValues((prevValues) => ({ ...prevValues, [name]: value }));
    }
  };

  function isValid_Aadhaar_Number(aadhaar_number) {
    let regex = new RegExp(/^[2-9]{1}[0-9]{3}\s[0-9]{4}\s[0-9]{4}$/);
    if (aadhaar_number == null) return false;
    return regex.test(aadhaar_number);
  }

  const handleValidation = () => {
    const { firstname, lastname, phone, aadhaar_number, parent_email, age } = values;

    if (!firstname || !lastname) {
      toast.error("First name and last name are required.", toastOptions);
      return false;
    }
    if (!phone || phone.length !== 10) {
      toast.error("Phone must be 10 digits.", toastOptions);
      return false;
    }
    if (!isValid_Aadhaar_Number(aadhaar_number)) {
      toast.error("Aadhaar number is invalid!", toastOptions);
      return false;
    }
    if (!parent_email) {
      toast.error("Parent email is required.", toastOptions);
      return false;
    }
    if (!age) {
      toast.error("Date of birth is required.", toastOptions);
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (handleValidation()) {
      try {
        const { data } = await axiosInstance.patch(completeProfileRoute, values);

        if (data.status === false) {
          toast.error(data.message, toastOptions);
        }
        if (data.status === true) {
          toast.success("Profile completed!", toastOptions);
          setTimeout(() => navigate("/"), 500);
        }
      } catch (error) {
        const msg = error.response?.data?.message || "Failed to save profile. Please try again.";
        toast.error(msg, toastOptions);
      }
    }
  };

  if (isLoading) {
    return (
      <FormContainer>
        <p style={{ color: "white" }}>Loading...</p>
      </FormContainer>
    );
  }

  return (
    <>
      <FormContainer>
        <form onSubmit={handleSubmit}>
          <div className="brand">
            <img className="w-15" src={Logo} alt="logo" />
            <h1 className="text-red-700">Complete Your Profile</h1>
          </div>
          <div className="flex">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="First Name"
                  name="firstname"
                  value={values.firstname}
                  onChange={(e) => handleChange(e)}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  name="lastname"
                  value={values.lastname}
                  onChange={(e) => handleChange(e)}
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Mobile No"
                  name="phone"
                  maxLength={10}
                  value={values.phone}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d{0,10}$/.test(value)) {
                      handleChange(e);
                    }
                  }}
                />
              </div>
            </div>
            <div className="border-l-1 ml-2 pl-2 border-[#7a73ff] flex flex-col gap-2">
              <input
                type="text"
                placeholder="Aadhaar Number"
                name="aadhaar_number"
                required
                onChange={(e) => handleChange(e)}
              />
              <input
                type="email"
                placeholder="Parent Email"
                name="parent_email"
                required
                onChange={(e) => handleChange(e)}
              />
              <input type="date" name="age" required onChange={(e) => handleChange(e)} />
              <div className="flex gap-2">
                <div className="flex justify-center items-center gap-2 input">
                  <label htmlFor="M" className="text-white flex gap-1 cursor-pointer">
                    <span className="capitalize">Male</span>
                    <input type="radio" name="gender" value="M" id="M" defaultChecked onChange={(e) => handleChange(e)} />
                  </label>
                  <label htmlFor="F" className="text-white flex gap-1 cursor-pointer">
                    <span className="capitalize">Female</span>
                    <input type="radio" name="gender" value="F" id="F" onChange={(e) => handleChange(e)} />
                  </label>
                  <label htmlFor="O" className="text-white flex gap-1 cursor-pointer">
                    <span className="capitalize">Others</span>
                    <input type="radio" name="gender" value="O" id="O" onChange={(e) => handleChange(e)} />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="font-light text-[1px]">Save Profile</button>
          </div>
        </form>
      </FormContainer>
      <ToastContainer />
    </>
  );
}

const FormContainer = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  align-items: center;
  background-color: #131324;
  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
    img {
      height: 5rem;
    }
    h1 {
      color: white;
      text-transform: uppercase;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    background-color: #00000076;
    border-radius: 2rem;
    padding: 3rem 5rem;
  }
  input, .input {
    background-color: transparent;
    padding: 1rem;
    border: 0.1rem solid #4e0eff;
    border-radius: 0.4rem;
    color: white;
    width: 100%;
    font-size: 1rem;
    &:focus {
      border: 0.1rem solid #997af0;
      outline: none;
    }
  }
  button {
    background-color: #4e0eff;
    color: white;
    padding: .5rem 1rem;
    border: none;
    font-weight: bold;
    cursor: pointer;
    border-radius: 0.4rem;
    font-size: .8rem;
    text-transform: uppercase;
    &:hover {
      background-color: #6b3fff;
    }
  }
`;
