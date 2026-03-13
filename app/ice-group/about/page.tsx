import React from "react";
import { Box, Typography, Link, List, ListItem } from "@mui/material";

// PAGE
export default async function Page() {
    /* About page for ice-ai application. */

    return (
        <Box>
            <Box id="about-legal">
                <Typography variant="h3" component="h1" gutterBottom>
                    About
                </Typography>

                <Box id="eula" sx={{ mb: 4 }}>
                    <Typography variant="h4" component="h2" gutterBottom>
                        End User License Agreement (EULA)
                    </Typography>

                    <Typography paragraph>
                        This website and its associated services ("Service") are provided by{" "}
                        <strong>I.C.E Solutions, limited</strong>. By accessing or attempting to
                        access this website, you agree to be bound by the terms of this End User
                        License Agreement ("Agreement").
                    </Typography>

                    <Typography paragraph>
                        If you do not agree to these terms, you must not access or use this
                        website.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        1. Acceptance of Terms
                    </Typography>
                    <Typography paragraph>
                        By accessing, viewing, or using this website, you acknowledge that you
                        have read, understood, and agree to be bound by this Agreement.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        2. Restricted Access
                    </Typography>
                    <Typography paragraph>
                        This website is a private system intended only for authorized users.
                        Unauthorized access, use, or attempted use of this system is strictly
                        prohibited.
                    </Typography>

                    <Typography paragraph>
                        Access may be restricted by authentication, network controls, or other
                        security measures. Any attempt to bypass or interfere with these controls
                        may result in immediate access termination and possible legal action.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        3. License Grant
                    </Typography>
                    <Typography paragraph>
                        Authorized users are granted a limited, non-transferable, revocable
                        license to access and use the Service solely for its intended internal
                        purposes.
                    </Typography>

                    <Typography paragraph>This license does not permit users to:</Typography>
                    <List sx={{ listStyleType: 'disc', pl: 4 }}>
                        <ListItem sx={{ display: 'list-item' }}>
                            Copy, reproduce, or distribute any part of the Service
                        </ListItem>
                        <ListItem sx={{ display: 'list-item' }}>
                            Reverse engineer, modify, or create derivative works
                        </ListItem>
                        <ListItem sx={{ display: 'list-item' }}>
                            Attempt to gain unauthorized access to systems or data
                        </ListItem>
                        <ListItem sx={{ display: 'list-item' }}>
                            Use the Service for unlawful purposes
                        </ListItem>
                    </List>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        4. Monitoring and Security
                    </Typography>
                    <Typography paragraph>
                        All activity on this system may be logged, monitored, and audited for
                        security, operational, and compliance purposes.
                    </Typography>

                    <Typography paragraph>By using this system, you consent to such monitoring.</Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        5. No Warranty
                    </Typography>
                    <Typography paragraph>
                        The Service is provided "as is" and "as available" without warranties of
                        any kind, whether express or implied, including but not limited to
                        fitness for a particular purpose, non-infringement, or availability.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        6. Limitation of Liability
                    </Typography>
                    <Typography paragraph>
                        To the maximum extent permitted by law, <strong>I.C.E Solutions, limited</strong>{" "}
                        shall not be liable for any damages arising from the use of, or inability
                        to use, this website.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        7. Termination
                    </Typography>
                    <Typography paragraph>
                        Access may be suspended or terminated at any time without notice for
                        security, operational, or policy reasons.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        8. Changes to This Agreement
                    </Typography>
                    <Typography paragraph>
                        We reserve the right to update or modify this Agreement at any time.
                        Continued use of the Service constitutes acceptance of the updated terms.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        9. Governing Law
                    </Typography>
                    <Typography paragraph>
                        This Agreement shall be governed by and construed in accordance with the
                        laws of the United Kingdom.
                    </Typography>
                </Box>

                <Box id="privacy-notice" sx={{ mb: 4 }}>
                    <Typography variant="h4" component="h2" gutterBottom>
                        Privacy Notice
                    </Typography>

                    <Typography paragraph>
                        This website is a restricted internal service and is not intended for
                        public use.
                    </Typography>

                    <Typography paragraph>
                        This notice describes how information may be collected and used when
                        accessing the site.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        1. Purpose
                    </Typography>
                    <Typography paragraph>
                        The purpose of this website is to provide a private service for
                        authorized users only.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        2. Information Collected
                    </Typography>
                    <Typography paragraph>
                        The system may automatically collect technical and operational data,
                        including:
                    </Typography>
                    <List sx={{ listStyleType: 'disc', pl: 4 }}>
                        <ListItem sx={{ display: 'list-item' }}>IP address</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>Browser and device information</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>Login activity</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>Access timestamps</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>Pages accessed</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>System logs and diagnostic information</ListItem>
                    </List>

                    <Typography paragraph>
                        This information is collected primarily for security, auditing, and
                        operational purposes.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        3. Use of Information
                    </Typography>
                    <Typography paragraph>Collected information may be used to:</Typography>
                    <List sx={{ listStyleType: 'disc', pl: 4 }}>
                        <ListItem sx={{ display: 'list-item' }}>Maintain system security</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>Detect unauthorized access</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>Investigate incidents</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>Improve system reliability</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>Ensure compliance with internal policies</ListItem>
                    </List>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        4. Data Sharing
                    </Typography>
                    <Typography paragraph>
                        Information collected through this website will not be sold or distributed
                        for marketing purposes.
                    </Typography>

                    <Typography paragraph>However, data may be shared when necessary to:</Typography>
                    <List sx={{ listStyleType: 'disc', pl: 4 }}>
                        <ListItem sx={{ display: 'list-item' }}>Comply with legal obligations</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>Protect system security</ListItem>
                        <ListItem sx={{ display: 'list-item' }}>Investigate misuse or unauthorized access</ListItem>
                    </List>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        5. Data Retention
                    </Typography>
                    <Typography paragraph>
                        Logs and related information may be retained for as long as reasonably
                        necessary for security, auditing, and operational purposes.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        6. Security
                    </Typography>
                    <Typography paragraph>
                        Reasonable administrative, technical, and organizational safeguards are
                        implemented to protect system data.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        7. Unauthorized Access
                    </Typography>
                    <Typography paragraph>
                        If you are not an authorized user, you should immediately exit this
                        website. Continued use may be considered unauthorized access.
                    </Typography>

                    <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 2 }}>
                        8. Contact
                    </Typography>
                    <Typography paragraph>
                        For questions regarding this notice, please contact:
                    </Typography>
                    <Typography paragraph>
                        <strong>I.C.E Solutions, limited</strong>
                        <br />
                        <Link href="mailto:graeme.smith@ice-group.ai">
                            graeme.smith@ice-group.ai
                        </Link>
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}

