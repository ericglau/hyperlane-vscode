import * as React from "react";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { useState } from "react";

export default function DeployContracts() {
  const [publicRpcUrls1, setPublicRpcUrls1] = useState([""]);
  const [validators1, setValidators1] = useState([""]);

  const [publicRpcUrls2, setPublicRpcUrls2] = useState([""]);
  const [validators2, setValidators2] = useState([""]);

  const addPublicRpcUrl1 = () => {
    setPublicRpcUrls1([...publicRpcUrls1, ""]);
  };

  const removePublicRpcUrl1 = (index: number) => {
    const updatedValues = [...publicRpcUrls1];
    updatedValues.splice(index, 1);
    setPublicRpcUrls1(updatedValues);
  };

  const handlePublicRpcUrlChange1 = (index: number, value: string) => {
    const updatedValues = [...publicRpcUrls1];
    updatedValues[index] = value;
    setPublicRpcUrls1(updatedValues);
  };

  const addValidator1 = () => {
    setValidators1([...validators1, ""]);
  };

  const removeValidator1 = (index: number) => {
    const updatedValues = [...validators1];
    updatedValues.splice(index, 1);
    setValidators1(updatedValues);
  };

  const handleValidatorChange1 = (index: number, value: string) => {
    const updatedValues = [...validators1];
    updatedValues[index] = value;
    setValidators1(updatedValues);
  };

  const addPublicRpcUrl2 = () => {
    setPublicRpcUrls2([...publicRpcUrls2, ""]);
  };

  const removePublicRpcUrl2 = (index: number) => {
    const updatedValues = [...publicRpcUrls2];
    updatedValues.splice(index, 1);
    setPublicRpcUrls2(updatedValues);
  };

  const handlePublicRpcUrlChange2 = (index: number, value: string) => {
    const updatedValues = [...publicRpcUrls2];
    updatedValues[index] = value;
    setPublicRpcUrls2(updatedValues);
  };

  const addValidator2 = () => {
    setValidators2([...validators2, ""]);
  };

  const removeValidator2 = (index: number) => {
    const updatedValues = [...validators2];
    updatedValues.splice(index, 1);
    setValidators2(updatedValues);
  };

  const handleValidatorChange2 = (index: number, value: string) => {
    const updatedValues = [...validators2];
    updatedValues[index] = value;
    setValidators2(updatedValues);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    console.log({
      chains: {
        [data.get("chainName1") as string]: {
          name: data.get("chainName1"),
          chainId: parseInt(data.get("chainId1") as string) || "",
          publicRpcUrls: publicRpcUrls1,
        },
        [data.get("chainName2") as string]: {
          name: data.get("chainName2"),
          chainId: parseInt(data.get("chainId2") as string) || "",
          publicRpcUrls: publicRpcUrls2,
        },
      },
      multisigIsmConfig: {
        [data.get("chainName1") as string]: {
          threshold: validators1.length,
          validators: validators1,
        },
        [data.get("chainName2") as string]: {
          threshold: validators2.length,
          validators: validators2,
        },
      },
    });
  };

  return (
    <Container component="main">
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}></Avatar>
        <Typography component="h1" variant="h5">
          Deploy Contracts
        </Typography>
        <Box component="form" noValidate onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="chainId1"
                  required
                  fullWidth
                  id="chainId1"
                  label="Chain ID"
                  autoFocus
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  id="chainName1"
                  label="Chain Name"
                  name="chainName1"
                />
              </Grid>
              <Grid item xs={12}>
                {publicRpcUrls1.map((value, index) => (
                  <div key={index} style={{ marginBottom: "10px" }}>
                    <TextField
                      fullWidth
                      required
                      value={value}
                      onChange={(e) =>
                        handlePublicRpcUrlChange1(index, e.target.value)
                      }
                      label={`Public RPC Url ${index + 1}`}
                    />
                    {publicRpcUrls1.length > 1 && (
                      <Button
                        variant="outlined"
                        onClick={() => removePublicRpcUrl1(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="contained" onClick={addPublicRpcUrl1}>
                  Add RPC
                </Button>
              </Grid>
              <Grid item xs={12}>
                {validators1.map((value, index) => (
                  <div key={index} style={{ marginBottom: "10px" }}>
                    <TextField
                      fullWidth
                      required
                      value={value}
                      onChange={(e) =>
                        handleValidatorChange1(index, e.target.value)
                      }
                      label={`Validator ${index + 1}`}
                    />
                    {validators1.length > 1 && (
                      <Button
                        variant="outlined"
                        onClick={() => removeValidator1(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="contained" onClick={addValidator1}>
                  Add Validator
                </Button>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="chainId2"
                  required
                  fullWidth
                  id="chainId2"
                  label="Chain ID"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  id="chainName2"
                  label="Chain Name"
                  name="chainName2"
                />
              </Grid>
              <Grid item xs={12}>
                {publicRpcUrls2.map((value, index) => (
                  <div key={index} style={{ marginBottom: "10px" }}>
                    <TextField
                      fullWidth
                      required
                      value={value}
                      onChange={(e) =>
                        handlePublicRpcUrlChange2(index, e.target.value)
                      }
                      label={`Public RPC Url ${index + 1}`}
                    />
                    {publicRpcUrls2.length > 1 && (
                      <Button
                        variant="outlined"
                        onClick={() => removePublicRpcUrl2(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="contained" onClick={addPublicRpcUrl2}>
                  Add RPC
                </Button>
              </Grid>
              <Grid item xs={12}>
                {validators2.map((value, index) => (
                  <div key={index} style={{ marginBottom: "10px" }}>
                    <TextField
                      fullWidth
                      required
                      value={value}
                      onChange={(e) =>
                        handleValidatorChange2(index, e.target.value)
                      }
                      label={`Validator ${index + 1}`}
                    />
                    {validators2.length > 1 && (
                      <Button
                        variant="outlined"
                        onClick={() => removeValidator2(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="contained" onClick={addValidator2}>
                  Add Validator
                </Button>
              </Grid>
            </Grid>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button type="submit" variant="contained" sx={{ mt: 3, mb: 2 }}>
              Deploy
            </Button>
          </div>
        </Box>
        <Grid container justifyContent="flex-end">
          <Grid item>
            <Link
              href="https://www.hyperlane.xyz/"
              variant="body2"
              target="_blank"
            >
              Hyperlane
            </Link>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
