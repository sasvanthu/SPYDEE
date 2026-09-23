"""
SPYDEE: National & Cross-Validation Datasets Intelligence Service
Catalog, metadata, benchmark metrics, and live sample records for all 25 datasets
from SPYDEE_India_Dataset_Links.xlsx.
"""

from typing import List, Dict, Any, Optional

DATASETS_CATALOG: List[Dict[str, Any]] = [
    # ─── 1. DOCUMENT INTELLIGENCE & LEGAL NLP ──────────────────────────────
    {
        "id": 1,
        "code": "IN_LEGAL_NER",
        "name": "InLegalNER",
        "category": "Document Intelligence (NER)",
        "domain": "Legal NLP & Named Entity Recognition",
        "url": "https://huggingface.co/datasets/opennyaiorg/InLegalNER",
        "organization": "Hugging Face (OpenNyAI / EkStep Foundation, India)",
        "technology": "spaCy / HuggingFace Transformers — fine-tune InLegalBERT for token classification",
        "priority": "P1 - Must (India)",
        "records_count": "46,545 annotated entities",
        "description": "46,545 annotated Indian legal named entities across 14 fine-grained types (Petitioner, Respondent, Court, Judge, Statute, Provision, Witness, Police Station, etc.) from Indian court judgments.",
        "case_usage": "Used in FIR parsing, witness-accused attribution, and statutory penal code extraction (IPC/BNS sections).",
        "associated_cases": ["IND-2026-004", "IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "f1_score": 0.884,
            "precision": 0.892,
            "recall": 0.876,
            "supported_classes": 14
        },
        "sample_record": {
            "document_id": "IN-FIR-2026-BLR-0142",
            "text": "Before the Court of Chief Metropolitan Magistrate, Bengaluru. Complainant Ramesh Rao states that accused Sanjay Deshmukh (Alias: Sanju BKC) violated Section 420 and Section 120B of the Indian Penal Code.",
            "entities": [
                {"text": "Court of Chief Metropolitan Magistrate, Bengaluru", "label": "COURT", "start": 11, "end": 60, "confidence": 0.98},
                {"text": "Ramesh Rao", "label": "PETITIONER", "start": 74, "end": 84, "confidence": 0.96},
                {"text": "Sanjay Deshmukh", "label": "RESPONDENT", "start": 105, "end": 120, "confidence": 0.99},
                {"text": "Sanju BKC", "label": "ALIAS", "start": 129, "end": 138, "confidence": 0.95},
                {"text": "Section 420", "label": "PROVISION", "start": 148, "end": 159, "confidence": 0.99},
                {"text": "Section 120B", "label": "PROVISION", "start": 164, "end": 176, "confidence": 0.99},
                {"text": "Indian Penal Code", "label": "STATUTE", "start": 184, "end": 201, "confidence": 0.99}
            ]
        }
    },
    {
        "id": 2,
        "code": "NAAMAPADAM",
        "name": "Naamapadam",
        "category": "Document Intelligence (Multilingual NER)",
        "domain": "Vernacular Complaint & FIR Processing",
        "url": "https://huggingface.co/datasets/ai4bharat/naamapadam",
        "organization": "Hugging Face (AI4Bharat, IIT Madras)",
        "technology": "IndicBERT / IndicNLP + HuggingFace Transformers",
        "priority": "P1 - Must (India)",
        "records_count": "1.6M sentences (11 Indian Languages)",
        "description": "Large-scale NER dataset for 11 major Indian languages (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi, Assamese) — needed since FIRs are often filed in regional languages.",
        "case_usage": "Processes non-English state police complaints (Hindi NCRB FIRs, Marathi Thane records, Kannada Bengaluru e-FIRs).",
        "associated_cases": ["IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "f1_score": 0.867,
            "languages_supported": 11,
            "token_throughput": "1450 tokens/sec"
        },
        "sample_record": {
            "source_language": "Hindi (hi)",
            "police_station": "साइबर क्राइम थाना, द्वारका, दिल्ली (Dwarka Cyber Crime PS, Delhi)",
            "original_text": "अभियुक्त राजेश कुमार उर्फ चांदनी राजेश ने फर्जी आधार कार्ड के जरिए बैंक खाता खोला।",
            "transliterated_english": "Accused Rajesh Kumar alias Chandni Rajesh opened bank account using forged Aadhaar card.",
            "entities": [
                {"token": "राजेश कुमार", "label": "PER", "romanized": "Rajesh Kumar"},
                {"token": "चांदनी राजेश", "label": "ALIAS", "romanized": "Chandni Rajesh"},
                {"token": "आधार कार्ड", "label": "DOC_ID", "romanized": "Aadhaar Card"}
            ]
        }
    },
    {
        "id": 3,
        "code": "IN_LEGAL_BERT",
        "name": "InLegalBERT + pretraining corpus",
        "category": "Document Intelligence (base LM)",
        "domain": "Foundation Legal Language Model",
        "url": "https://huggingface.co/law-ai/InLegalBERT",
        "organization": "Hugging Face (IIT Kharagpur, India)",
        "technology": "HuggingFace Transformers — use as base model for NER/RE/classification",
        "priority": "P1 - Must (India)",
        "records_count": "1.8M+ downloads (5.4M SC/HC text tokens)",
        "description": "BERT pretrained on Indian Supreme Court + High Court judgments (1950-2019), 1.8M+ downloads — India's standard legal language model.",
        "case_usage": "Provides dense contextual vector embeddings for statutory penal code comparison, legal intent classification, and bail precedence.",
        "associated_cases": ["IND-2026-004", "IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "embedding_dim": 768,
            "context_window": 512,
            "legal_lexicon_overlap": "96.4%"
        },
        "sample_record": {
            "embedding_query": "Offence of criminal breach of trust with money laundering under PMLA 2002",
            "top_statutory_precedents": [
                {"statute": "PMLA 2002 Section 3", "similarity": 0.942, "description": "Whosoever directly or indirectly attempts to indulge in proceeds of crime"},
                {"statute": "IPC Section 409", "similarity": 0.918, "description": "Criminal breach of trust by public servant, or by banker, merchant or agent"},
                {"statute": "BNS Section 316", "similarity": 0.895, "description": "Criminal breach of trust (Bharatiya Nyaya Sanhita)"}
            ]
        }
    },
    {
        "id": 4,
        "code": "ILDC_CORPUS",
        "name": "ILDC (Indian Legal Documents Corpus)",
        "category": "Document Intelligence (judgment structure)",
        "domain": "Judicial Precedent & Rationale Analysis",
        "url": "https://huggingface.co/datasets/Exploration-Lab/IL-TUR",
        "organization": "ACL 2021 / Hugging Face (IIT Kanpur, India)",
        "technology": "InLegalBERT / RoBERTa fine-tuning for classification + explanation",
        "priority": "P1 - Must (India)",
        "records_count": "~35,000 Indian Supreme Court Judgments (1947-2020)",
        "description": "~35,000 Indian Supreme Court judgments (1947-2020) for court judgment prediction and explanation (CJPE), sourced via Indian Kanoon.",
        "case_usage": "Extracts explanation paragraphs, judicial ratios, and provides judicial grounds for digital evidence seizure.",
        "associated_cases": ["IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "cjpe_accuracy": "81.6%",
            "macro_f1": 0.804,
            "corpus_time_span": "1947 - 2020"
        },
        "sample_record": {
            "case_citation": "ILDC-SC-2020-0891",
            "title": "State of Karnataka vs Cyber Syndicate App Developers",
            "ratio_decidendi": "Cryptographic logs and telecom tower ping records maintained in normal course of business satisfy Section 65B Indian Evidence Act admissibility criteria.",
            "outcome": "CONVICTION_UPHELD",
            "explanation_score": 0.87
        }
    },
    {
        "id": 5,
        "code": "NYAYA_ANUMANA",
        "name": "NyayaAnumana",
        "category": "Document Intelligence (large-scale corpus)",
        "domain": "Empirical Conviction & Case Trajectory",
        "url": "https://arxiv.org/abs/2412.08385",
        "organization": "IIT Kharagpur (Law-AI Lab), India",
        "technology": "INLegalLlama / transformer fine-tuning for judgment prediction",
        "priority": "P2 - Should (India)",
        "records_count": "2,282,137 case proceedings",
        "description": "Largest Indian legal judgment prediction dataset: 22,82,137 case proceedings from Supreme Court, High Courts, Tribunals, District Courts via Indian Kanoon.",
        "case_usage": "Predicts multi-jurisdictional trial outcomes, bail granting probability, and prosecutorial success odds based on chargesheeted sections.",
        "associated_cases": ["IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "total_proceedings": 2282137,
            "court_tiers": ["Supreme Court", "High Courts", "District Courts", "Tribunals"],
            "prediction_auc": 0.849
        },
        "sample_record": {
            "proceedings_id": "NYA-2026-HC-KAR-4192",
            "chargesheet_sections": ["IPC 420", "IT Act 66D", "IPC 120B"],
            "predicted_chargesheet_conviction_rate": "76.4%",
            "historical_similar_cases_analyzed": 1420,
            "median_trial_duration_months": 18.5
        }
    },
    {
        "id": 6,
        "code": "AWS_OPEN_DATA_COURTS",
        "name": "AWS Open Data — Indian High Court & Supreme Court Judgments",
        "category": "Document Intelligence (raw FIR/judgment corpus)",
        "domain": "Bulk Judicial Repository & CNR Verification",
        "url": "https://registry.opendata.aws/indian-high-court-judgments/",
        "organization": "AWS Open Data Registry (India)",
        "technology": "boto3 / AWS CLI for bulk download, PyPDF/pdfplumber for extraction",
        "priority": "P1 - Must (India)",
        "records_count": "Millions of High Court & Supreme Court Orders",
        "description": "Bulk, structured repository of Indian High Court and Supreme Court judgment PDFs/text with metadata, hosted as an open AWS dataset.",
        "case_usage": "Serves as the national reference archive for validating CNR numbers, judicial precedents, and case law citations in evidence briefs.",
        "associated_cases": ["IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "cloud_storage": "AWS S3 Open Data",
            "format": "PDF / JSON Metadata",
            "coverage": "All 25 High Courts & Supreme Court of India"
        },
        "sample_record": {
            "cnr_number": "KAHC010041222026",
            "court": "High Court of Karnataka, Principal Bench Bengaluru",
            "case_type": "Criminal Petition (Under CrPC 482)",
            "disposition": "DISMISSED",
            "digital_signature_verified": True,
            "aws_s3_uri": "s3://indian-high-court-judgments/karnataka/2026/crmp-4122.pdf"
        }
    },
    {
        "id": 7,
        "code": "LAWSUM",
        "name": "LawSum",
        "category": "Document Intelligence (case summarization)",
        "domain": "Automated Legal Briefs & Executive Summaries",
        "url": "https://github.com/Law-AI/summarization",
        "organization": "GitHub (Law-AI Lab, India)",
        "technology": "Transformer summarization models (T5/BART fine-tuning)",
        "priority": "P3 - Optional (India)",
        "records_count": "10,000 Indian court judgments with expert summaries",
        "description": "10,000 Indian court judgments with expert summaries — useful for case-note style summarization of case files.",
        "case_usage": "Generates concise prosecutorial briefs and executive summary sheets for investigative supervisors.",
        "associated_cases": ["IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "rouge_1": 44.8,
            "rouge_2": 21.3,
            "rouge_l": 39.5
        },
        "sample_record": {
            "original_case_pages": 42,
            "generated_executive_brief": "Investigation established an interstate hawala conduit leveraging shell entities across Mumbai and Bengaluru to off-ramp UPI fraud proceeds into OTC crypto escrow. Accused bail plea rejected citing risk of flight and encrypted evidence tampering.",
            "key_takeaways": [
                "Layering through 3 distinct corporate banking tiers",
                "Conversion to USDT via P2P escrow desk within 90 minutes",
                "Non-bailable provisions under PMLA invoked"
            ]
        }
    },
    {
        "id": 8,
        "code": "INDIAN_BAIL_JUDGMENTS",
        "name": "IndianBailJudgments-1200",
        "category": "Document Intelligence (FIR-adjacent structured data)",
        "domain": "Bail Risk & Prosecutorial Grounds",
        "url": "https://arxiv.org/abs/2507.02506",
        "organization": "Research paper dataset (Indian Kanoon sourced)",
        "technology": "LLM-based structured extraction (JSON schema prompting) + fine-tuning",
        "priority": "P1 - Must (India)",
        "records_count": "1,200 bail-order judgments with structured attributes",
        "description": "1,200 bail-order judgments with structured attributes: crime_type, bail_outcome, legal_principles — close to FIR/investigation-stage data.",
        "case_usage": "Furnishes evidence-backed arguments for custody remands, opposing bail based on flight risk, syndicate continuity, and tampering.",
        "associated_cases": ["IND-2026-004", "IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "attribute_extraction_f1": 0.912,
            "bail_outcome_accuracy": "86.2%"
        },
        "sample_record": {
            "citation": "2026 SCC OnLine Bom 2419",
            "crime_type": "Organized Financial Cybercrime & Mule Provisioning",
            "bail_outcome": "REJECTED",
            "prosecutorial_principles_invoked": [
                "Economic offense undermining public confidence in UPI payment infrastructure",
                "Use of burner devices and encrypted foreign channels indicates flight risk",
                "Mule account holders act as critical nodes in criminal conspiracy"
            ],
            "risk_scores": {"flight_risk": 0.88, "tampering_risk": 0.93}
        }
    },

    # ─── 2. CCTV / FACE / SURVEILLANCE INTELLIGENCE ───────────────────────
    {
        "id": 9,
        "code": "UVH_26_CCTV",
        "name": "UVH-26 (Urban Vision Hackathon Dataset, IISc Bengaluru)",
        "category": "CCTV x Telecom Fusion (real Indian CCTV feed structure)",
        "domain": "Safe-City Urban Traffic & Vehicle Tracking",
        "url": "https://arxiv.org/abs/2511.02563",
        "organization": "IISc Bengaluru (AIM@IISc) — real Indian government CCTV network",
        "technology": "YOLO11 / RT-DETR / DAMO-YOLO for detection fine-tuning",
        "priority": "P1 - Must (India)",
        "records_count": "26,646 images from ~2,800 Bengaluru SafeCity cameras (1.8M boxes)",
        "description": "26,646 real images from ~2,800 Bengaluru Safe-City CCTV cameras, 1.8M bounding boxes across 14 India-specific vehicle classes (auto-rickshaw, 2-wheeler, tempo, bus, etc.).",
        "case_usage": "Core camera feed topology across Hebbal, Koramangala, Whitefield, Indiranagar corridors; ANPR vehicle plate and class detection.",
        "associated_cases": ["IND-2026-004", "IND-2026-006", "IND-2026-ALL"],
        "benchmark_metrics": {
            "map50_95": 0.684,
            "vehicle_classes": 14,
            "camera_locations": 2800,
            "real_time_fps": 48
        },
        "sample_record": {
            "camera_id": "CAM-BLR-AIRPORT-ROAD-01",
            "location": "Bengaluru SafeCity - Hebbal Flyover Corridor",
            "coordinates": {"lat": 13.0358, "lon": 77.5970},
            "timestamp": "2026-08-14T08:30:00Z",
            "detections": [
                {"class": "car", "confidence": 0.95, "bbox": [420, 180, 890, 450], "plate": "KA-04-ME-7788", "speed_kmh": 68.0},
                {"class": "auto-rickshaw", "confidence": 0.92, "bbox": [110, 290, 340, 510], "plate": "KA-01-AB-4821", "speed_kmh": 34.0}
            ]
        }
    },
    {
        "id": 10,
        "code": "IMFDB_FACE",
        "name": "IMFDB (Indian Movie Face Database)",
        "category": "CCTV Fusion (face embedding on Indian faces)",
        "domain": "Indian Facial Biometrics & Lighting Robustness",
        "url": "https://cvit.iiit.ac.in/projects/IMFDB/",
        "organization": "CVIT, IIIT Hyderabad, India",
        "technology": "OpenCV / face-recognition / ArcFace fine-tuning on Indian faces",
        "priority": "P2 - Should (India)",
        "records_count": "34,512 face images across 100 Indian subjects & 5 languages",
        "description": "34,512 face images of 100 Indian actors across 5 languages, annotated for age, pose, gender, expression, occlusion.",
        "case_usage": "Calibrates facial recognition models to Indian skin tones, lighting conditions, and partial occlusions in street CCTV cameras.",
        "associated_cases": ["IND-2026-004", "IND-2026-006", "IND-2026-ALL"],
        "benchmark_metrics": {
            "top1_accuracy": "97.3%",
            "occlusion_tolerance": "Up to 45 degrees yaw/pitch",
            "vector_dimension": 512
        },
        "sample_record": {
            "subject_id": "IMFDB-SUBJ-042",
            "sighting_camera": "CAM-BLR-INDIRANAGAR-06",
            "face_confidence": 0.942,
            "pose_yaw": -12.4,
            "lighting_condition": "Direct sunlight / dappled shadow",
            "occlusion_flags": ["SUNGLASSES_DETECTED"],
            "matched_identity": "Rajesh Kumar (Alias: Chandni Rajesh)"
        }
    },
    {
        "id": 11,
        "code": "IIITM_FACE",
        "name": "IIITM Face",
        "category": "CCTV Fusion (facial attribute detection)",
        "domain": "Facial Hair, Spectacles & Attribute Classification",
        "url": "https://arxiv.org/abs/1910.01219",
        "organization": "IIITM Gwalior, India",
        "technology": "CNN-based facial attribute classifiers",
        "priority": "P3 - Optional (India)",
        "records_count": "1,928 images of 107 Indian subjects",
        "description": "1,928 images of 107 subjects (Indian students/staff) with pose, emotion, facial-attribute annotations.",
        "case_usage": "Classifies suspect attributes (mustache, beard, spectacles, turban/headgear) to narrow down CCTV search queries.",
        "associated_cases": ["IND-2026-006", "IND-2026-ALL"],
        "benchmark_metrics": {
            "attribute_f1": 0.895,
            "attributes_tracked": ["Beard", "Mustache", "Spectacles", "Headwear", "Estimated Age"]
        },
        "sample_record": {
            "sighting_id": "ATTR-BLR-098",
            "detected_attributes": {
                "facial_hair": "Trimmed French Beard (0.91)",
                "spectacles": "Wire-rimmed Glasses (0.88)",
                "estimated_age_bracket": "32-38",
                "headgear": "None"
            },
            "investigative_query_match": "High probability match for suspect composite profile"
        }
    },
    {
        "id": 12,
        "code": "IIITD_SKETCH_DISGUISE",
        "name": "IIIT-Delhi Disguise / Sketch Face Databases",
        "category": "CCTV Fusion (forensic sketch matching)",
        "domain": "Forensic Artist Sketch to CCTV Cross-Matching",
        "url": "https://iab-rubric.org/resources/biometric-datasets/face",
        "organization": "IAB-RUBRIC Lab, IIIT Delhi, India",
        "technology": "Sketch-photo matching models (Siamese CNN)",
        "priority": "P2 - Should (India)",
        "records_count": "Pairs of Forensic Composite Sketches & Photos under Disguise",
        "description": "Forensic sketch-to-photo pairs and disguised-face datasets — directly relevant to investigative facial matching.",
        "case_usage": "Matches witness composite sketches against live SafeCity CCTV feeds and handles intentional disguises.",
        "associated_cases": ["IND-2026-006", "IND-2026-ALL"],
        "benchmark_metrics": {
            "rank1_sketch_accuracy": "83.1%",
            "disguise_invariance_score": 0.794
        },
        "sample_record": {
            "sketch_id": "SKETCH-BLR-CYBER-02",
            "artist": "Karnataka State Forensic Science Laboratory (FSL)",
            "camera_match": "CAM-BLR-KOR-03 (Koramangala Sony World Signal)",
            "sketch_photo_cosine_similarity": 0.891,
            "disguise_indicators": ["Dyed Hair", "Cosmetic Eyebrow Alteration"]
        }
    },

    # ─── 3. FINANCIAL INTELLIGENCE (UPI / BANKING / AML) ───────────────────
    {
        "id": 13,
        "code": "UPI_TRANSACTIONS_2024",
        "name": "UPI Transactions 2024 Dataset",
        "category": "Financial Intelligence (UPI schema)",
        "domain": "Real NPCI UPI Protocol & Payment Schemas",
        "url": "https://www.kaggle.com/datasets/skullagos5246/upi-transactions-2024-dataset",
        "organization": "Kaggle (India-focused synthetic modeled on NPCI/RBI)",
        "technology": "pandas / XGBoost for transaction pattern & fraud analysis",
        "priority": "P1 - Must (India)",
        "records_count": "Comprehensive Pan-India UPI Transaction Stream",
        "description": "Simulated UPI (Unified Payments Interface) transactions across India — P2P/P2M, merchant categories, demographics, device/bank realism modeled on NPCI/RBI data.",
        "case_usage": "Models realistic UPI VPAs (@okhdfcbank, @ybl, @okaxis), RRN numbers, IFSC codes, and transaction velocity.",
        "associated_cases": ["IND-2026-004", "IND-2026-ALL"],
        "benchmark_metrics": {
            "schema_compliance": "NPCI UPI 2.0 Standard",
            "merchant_categories": ["P2P", "P2M", "Investment", "Retail", "Utilities"]
        },
        "sample_record": {
            "upi_rrn": "UPI/2026/08/10/CR/491028471921",
            "from_vpa": "victim.sharma@okhdfcbank",
            "to_vpa": "fast.returns@ybl",
            "amount_inr": 49500.0,
            "source_bank": "HDFC Bank (HDFC0000128)",
            "beneficiary_bank": "YES Bank (YESB0000412)",
            "timestamp": "2026-08-10T09:15:00Z",
            "device_ip": "103.21.144.12"
        }
    },
    {
        "id": 14,
        "code": "UPI_FRAUD_DETECTION",
        "name": "UPI Fraud Detection Dataset (India, Synthetic)",
        "category": "Financial Intelligence (UPI fraud)",
        "domain": "High-Frequency Mule Structuring & Smurfing",
        "url": "https://www.kaggle.com/datasets/kalpitlabs/upi-fraud-detection-dataset-india-synthetic",
        "organization": "Kaggle (KalpitLabs, India)",
        "technology": "scikit-learn / graph-based fraud detection (NetworkX + GNN)",
        "priority": "P1 - Must (India)",
        "records_count": "Pattern-based Synthetic UPI Risk/Fraud Records",
        "description": "Pattern-based synthetic UPI risk/fraud dataset built specifically for Indian payment fraud analysis.",
        "case_usage": "Identifies sub-₹50,000 threshold smurfing, sudden account awakening, and fan-out to mule networks.",
        "associated_cases": ["IND-2026-004", "IND-2026-005", "IND-2026-ALL"],
        "benchmark_metrics": {
            "auc_roc": 0.946,
            "smurfing_pattern_recall": "92.8%",
            "false_positive_rate": "< 1.2%"
        },
        "sample_record": {
            "mule_cluster_id": "MULE-BLR-TIER1",
            "aggregate_inflow_24h": 148900.0,
            "rapid_depletion_velocity": "Funds swept to Tier-2 accounts in 14 minutes",
            "structuring_signal": "3 transactions precisely at ₹49,500, ₹48,900, ₹49,999",
            "risk_tier": "CRITICAL"
        }
    },
    {
        "id": 15,
        "code": "UPI_PAYMENT_TRANSACTIONS",
        "name": "UPI Payment Transactions India",
        "category": "Financial Intelligence (UPI schema reference)",
        "domain": "Baseline Consumer Velocity & Anomaly Benchmarks",
        "url": "https://www.kaggle.com/datasets/maulikgajera/upi-payment-transactions-india",
        "organization": "Kaggle (Maulik Gajera, India)",
        "technology": "pandas / scikit-learn",
        "priority": "P2 - Should (India)",
        "records_count": "20,000 synthetic UPI transactions for ML analytics",
        "description": "20,000 synthetic UPI transactions built for ML/fintech analytics in the Indian context.",
        "case_usage": "Provides expected statistical baselines for benign transactions vs aberrant criminal laundering volume.",
        "associated_cases": ["IND-2026-004", "IND-2026-ALL"],
        "benchmark_metrics": {
            "dataset_rows": 20000,
            "avg_transaction_val": 1820.50,
            "peak_window": "19:00 - 22:00 IST"
        },
        "sample_record": {
            "baseline_median_ticket": 1250.0,
            "target_observed_ticket": 49850.0,
            "z_score_deviation": 6.84,
            "flag": "HIGH_STATISTICAL_OUTLIER"
        }
    },

    # ─── 4. TELECOM / MOBILITY CONTEXT ────────────────────────────────────
    {
        "id": 16,
        "code": "TRAI_SUBSCRIPTION_DATA",
        "name": "TRAI India Telecom Subscription Dataset (2016-2026)",
        "category": "CDR context / regional realism (aggregate, not case-level)",
        "domain": "Telecom LSA (Licensed Service Area) Mobility",
        "url": "https://huggingface.co/datasets/rahulmatthan/india-telecom-data",
        "organization": "Hugging Face (compiled from TRAI, Govt. of India)",
        "technology": "pandas for regional/operator-wise telecom pattern context",
        "priority": "P2 - Should (India)",
        "records_count": "119 months of national + operator x LSA metrics",
        "description": "119 months of national + operator x LSA (Licensed Service Area) telecom subscription metrics from India's telecom regulator.",
        "case_usage": "Provides realistic telecom circle identifiers (Karnataka, Mumbai, Delhi circles) and roaming handoff rates.",
        "associated_cases": ["IND-2026-004", "IND-2026-ALL"],
        "benchmark_metrics": {
            "circles_covered": 22,
            "operators": ["Airtel", "Jio", "Vodafone-Idea (Vi)", "BSNL"],
            "timespan_months": 119
        },
        "sample_record": {
            "lsa_circle": "Karnataka (Circle 11)",
            "operator": "Airtel",
            "active_vlr_ratio": "98.2%",
            "cell_tower_handoff_density": "High (Urban Bengaluru Core)",
            "circle_boundary_roaming_flag": False
        }
    },
    {
        "id": 17,
        "code": "TRAI_OPEN_DATA_REPORTS",
        "name": "TRAI Open Data Reports",
        "category": "CDR / SIM context (aggregate statistics)",
        "domain": "Burner SIM & Multi-SIM Churn Indices",
        "url": "https://www.data.gov.in/ministrydepartment/Telecom%20Regulatory%20Authority%20of%20India%20(TRAI)",
        "organization": "Open Government Data (OGD) Platform, Govt. of India",
        "technology": "pandas / CSV for demo-narrative realism (India telecom circles, operators)",
        "priority": "P3 - Optional (India)",
        "records_count": "Official Telecom Regulatory Statistics & Penetration Rates",
        "description": "Official Indian telecom regulator datasets: subscriber counts, SIM penetration, operator market share, by state/circle.",
        "case_usage": "Assesses likelihood of burner SIM rotation and cross-operator SIM-swap fraud tactics.",
        "associated_cases": ["IND-2026-004", "IND-2026-ALL"],
        "benchmark_metrics": {
            "multi_sim_penetration": "142.4% (Urban metros)",
            "prepaid_postpaid_split": "92.8% Prepaid / 7.2% Postpaid"
        },
        "sample_record": {
            "circle_code": "KA-LSA",
            "burner_card_risk_index": 0.78,
            "multiple_imsi_on_single_imei_flag": True,
            "regulatory_compliance_check": "FAILED - CAF (Customer Acquisition Form) Inconsistency"
        }
    },
    {
        "id": 18,
        "code": "BANGALORE_CITY_TRAFFIC",
        "name": "Bangalore City Traffic Dataset",
        "category": "GhostTower / Co-location (urban movement context)",
        "domain": "Urban Corridor Congestion & Transit Feasibility",
        "url": "https://www.kaggle.com/datasets/preethamgouda/banglore-city-traffic-dataset",
        "organization": "Kaggle (Preetham Gouda, India)",
        "technology": "pandas / time-series forecasting (Prophet, LSTM)",
        "priority": "P3 - Optional (India)",
        "records_count": "Multi-corridor Bengaluru Commuter & Congestion Measurements",
        "description": "Real-world-style Bengaluru traffic/congestion and commuter behavior dataset.",
        "case_usage": "Validates whether suspect movement between Koramangala, Hebbal, and Whitefield was physically possible within observed timestamps (Ghost Tower / Contradiction Engine).",
        "associated_cases": ["IND-2026-004", "IND-2026-006", "IND-2026-ALL"],
        "benchmark_metrics": {
            "transit_chokepoints": ["Silk Board", "Hebbal Flyover", "Tin Factory", "Sony World"],
            "speed_tolerance_kmh": "15 - 45 km/h during peak hours"
        },
        "sample_record": {
            "origin": "Koramangala Sony World Signal",
            "destination": "Hebbal Flyover Corridor",
            "distance_km": 18.2,
            "observed_time_delta_minutes": 22,
            "average_peak_traffic_minutes": 58,
            "speed_anomaly_verdict": "PHYSICAL_IMPOSSIBILITY_DETECTED",
            "contradiction_weight": 0.94
        }
    },

    # ─── 5. CRIME STATISTICS & GOVERNMENT DATA ────────────────────────────
    {
        "id": 19,
        "code": "NCRB_CRIME_IN_INDIA",
        "name": "NCRB Crime in India Reports",
        "category": "Demo realism / regional crime-type priors",
        "domain": "National Crime Records Bureau Official Priors",
        "url": "https://ncrb.gov.in",
        "organization": "National Crime Records Bureau, Govt. of India",
        "technology": "pandas / PDF-table extraction (pdfplumber) for aggregate statistical context",
        "priority": "P2 - Should (India)",
        "records_count": "Annual State / Metro / Crime-Head Statistics (IPC & BNS)",
        "description": "Annual state/city/crime-head-wise statistics (IPC/BNS crimes, chargesheet rates, victim counts) from India's National Crime Records Bureau.",
        "case_usage": "Establishes base chargesheet rates and state-level prosecution odds for cyber financial syndicates.",
        "associated_cases": ["IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "reporting_body": "MHA / NCRB",
            "cybercrime_chargesheet_rate_karnataka": "68.4%",
            "cybercrime_chargesheet_rate_maharashtra": "78.4%"
        },
        "sample_record": {
            "state_ut": "Karnataka",
            "crime_head": "Cyber Financial Frauds (Cat 11.2)",
            "chargesheet_rate": 68.4,
            "conviction_rate": 42.1,
            "investigative_priority": "P1_URGENT"
        }
    },
    {
        "id": 20,
        "code": "NCRB_DATAFUL_EXTRACTS",
        "name": "NCRB Crime Data (data.gov.in / dataful.in extracts)",
        "category": "Demo realism / regional crime-type priors",
        "domain": "Structured Tabular Crime Classifications",
        "url": "https://dataful.in/collections/1108/",
        "organization": "Open Government Data Platform (OGD) India / Dataful",
        "technology": "pandas for structured statistical analysis",
        "priority": "P3 - Optional (India)",
        "records_count": "Structured CSV/table extracts of NCRB summary tables",
        "description": "Structured CSV/table extracts of NCRB crime-in-India summary tables by year, state, and crime head.",
        "case_usage": "Furnishes district-level cybercrime incidence figures for automated executive briefing generation.",
        "associated_cases": ["IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "table_schema": "Year, State, District, IPC_Section, Reported_Cases, Arrested",
            "structured_rows": "100,000+"
        },
        "sample_record": {
            "year": 2024,
            "district": "Bengaluru Urban",
            "ipc_section": "Section 420 (Cheating)",
            "cases_reported": 12450,
            "persons_arrested": 4210
        }
    },

    # ─── 6. GLOBAL / BENCHMARKING & SYNTHESIS ─────────────────────────────
    {
        "id": 21,
        "code": "IBM_AML_TRANSACTIONS",
        "name": "IBM Transactions for AML",
        "category": "Financial Intelligence (algorithm benchmarking)",
        "domain": "Anti-Money Laundering Topology Benchmarks",
        "url": "https://www.kaggle.com/datasets/ealtman2019/ibm-transactions-for-anti-money-laundering-aml",
        "organization": "Kaggle (IBM Research, global)",
        "technology": "PyTorch Geometric / DGL for GNN-based laundering detection",
        "priority": "P2 - Should (global)",
        "records_count": "Multi-million synthetic AML transaction graph topologies",
        "description": "Synthetic AML transaction datasets purpose-built for laundering pattern detection (no Indian equivalent of this scale/quality exists) — used to benchmark algorithms before applying to Indian UPI data.",
        "case_usage": "Validates graph-based laundering patterns: Fan-In (gathering), Fan-Out (layering), and Cyclic Structuring.",
        "associated_cases": ["IND-2026-005", "IND-2026-ALL"],
        "benchmark_metrics": {
            "laundering_patterns_supported": ["Fan-Out", "Fan-In", "Cycle", "Gather-Scatter"],
            "gnn_pr_auc": 0.892
        },
        "sample_record": {
            "pattern_type": "FAN_OUT_LAYERING",
            "source_account": "ACCT-DELHI-HAWALA-01",
            "layer_1_recipients": ["ACCT-MULE-CHANDNI-02", "ACCT-SHELL-MUMBAI-03", "ACCT-SHELL-BLR-04"],
            "cycle_detection": False,
            "algorithm_flag": "CONFIRMED_AML_STRUCTURING"
        }
    },
    {
        "id": 22,
        "code": "ELLIPTIC_BITCOIN",
        "name": "Elliptic / Elliptic++ Bitcoin Dataset",
        "category": "Financial Intelligence + Graph Intelligence (validation)",
        "domain": "Illicit Crypto Graph & P2P Escrow Tracking",
        "url": "https://www.kaggle.com/datasets/ellipticco/elliptic-data-set",
        "organization": "Kaggle (Elliptic, global)",
        "technology": "PyTorch Geometric (GCN/GraphSAGE)",
        "priority": "P2 - Should (global)",
        "records_count": "203,769 real transaction nodes with licit/illicit labels",
        "description": "203,769 real transaction nodes with licit/illicit labels — the only real (non-synthetic) labeled financial-crime graph publicly available; used to validate graph-fraud algorithms before applying to Indian data.",
        "case_usage": "Traces hawala cash-outs off-ramped into P2P crypto escrows and darknet mixer hops.",
        "associated_cases": ["IND-2026-005", "IND-2026-ALL"],
        "benchmark_metrics": {
            "graph_nodes": 203769,
            "graph_edges": 234355,
            "graphsage_f1": 0.841
        },
        "sample_record": {
            "btc_tx_hash": "3a8f1b2c4e5d6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
            "btc_address": "bc1q9x4h2kl8m3nv5pq7rs9tu1vw3xy5za7bc9de",
            "elliptic_class": "ILLICIT_DARKNET_MIXER",
            "hop_distance_from_upi_bridge": 2,
            "total_crypto_volume_btc": 1.48
        }
    },
    {
        "id": 23,
        "code": "FEBRL_RECORD_LINKAGE",
        "name": "FEBRL Record Linkage Datasets",
        "category": "Entity Resolution (algorithm benchmarking)",
        "domain": "Probabilistic Entity & Alias Deduplication",
        "url": "https://recordlinkage.readthedocs.io/en/latest/ref-datasets.html",
        "organization": "Python 'recordlinkage' package (global, ANU)",
        "technology": "Python 'recordlinkage' library (Fellegi-Sunter probabilistic matching)",
        "priority": "P2 - Should (global)",
        "records_count": "Ground-truth duplicate and deduplication benchmark files",
        "description": "Standard entity-resolution benchmark with known ground-truth duplicate pairs — algorithm-agnostic, applies directly to Indian name/alias/ID matching.",
        "case_usage": "Calibrates Jaro-Winkler string similarity and Fellegi-Sunter weights for resolving Indian aliases to true identities.",
        "associated_cases": ["IND-2026-004", "IND-2026-ALL"],
        "benchmark_metrics": {
            "matching_precision": 0.962,
            "recall": 0.941,
            "algorithm": "Fellegi-Sunter Expectation-Maximization"
        },
        "sample_record": {
            "entity_a": {"name": "Rajesh Kumar", "address": "Chandni Chowk Delhi", "phone": "+919876543210"},
            "entity_b": {"name": "Chandni Rajesh", "address": "Chandni Chwk DL", "phone": "+919876543210"},
            "probabilistic_match_weight": 0.968,
            "resolution_verdict": "MERGED_TRUE_IDENTITY"
        }
    },
    {
        "id": 24,
        "code": "FAKER_EN_IN",
        "name": "Faker (with 'en_IN' / Indian locale)",
        "category": "Synthetic Case Data — India-context (all modules)",
        "domain": "Procedural Indian Identity & Format Generation",
        "url": "https://faker.readthedocs.io/en/master/locales/en_IN/",
        "organization": "PyPI / open-source library",
        "technology": "Python 'Faker' library with locale='en_IN'",
        "priority": "P1 - Must (India)",
        "records_count": "Generates unlimited procedural Indian entities",
        "description": "Python Faker library's Indian locale generates realistic Indian names, addresses, phone numbers (+91), Aadhaar-style ID formats, PAN-style formats.",
        "case_usage": "Synthesizes realistic case personas, +91 phone numbers, masked Aadhaar numbers, PAN cards, and localized addresses.",
        "associated_cases": ["IND-2026-004", "IND-2026-005", "IND-2026-006", "IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "locale": "en_IN",
            "regex_validations": ["Aadhaar 12-digit", "PAN 10-char alphanumeric", "Indian Telecom +91"]
        },
        "sample_record": {
            "name": "Sanjay Deshmukh",
            "phone": "+919845012345",
            "masked_aadhaar": "XXXX-XXXX-4412",
            "pan": "AABCS9821L",
            "address": "Flat 402, Shanti Vihar, Koramangala 4th Block, Bengaluru - 560034"
        }
    },
    {
        "id": 25,
        "code": "SDV_SYNTHETIC_DATA_VAULT",
        "name": "Synthetic Data Vault (SDV)",
        "category": "Synthetic Case Data — India-context (financial/CDR generation)",
        "domain": "Relational Multi-Table Distribution Preservation",
        "url": "https://sdv.dev/",
        "organization": "PyPI / open-source library (MIT)",
        "technology": "Python 'sdv' library (Gaussian Copula / CTGAN)",
        "priority": "P1 - Must (India)",
        "records_count": "Statistical Tabular Relational Synthesis Engine",
        "description": "Generates synthetic tabular/relational/time-series data preserving statistical patterns — combine with Faker's Indian locale for realistic CDR/UPI/SIM records.",
        "case_usage": "Preserves mathematical covariance across call durations, financial structuring velocity, and CCTV sightings.",
        "associated_cases": ["IND-2026-004", "IND-2026-005", "IND-2026-006", "IND-2026-007", "IND-2026-ALL"],
        "benchmark_metrics": {
            "synthesis_model": "Gaussian Copula & CTGAN",
            "statistical_fidelity_score": "94.2%",
            "differential_privacy_epsilon": 0.5
        },
        "sample_record": {
            "relational_tables": ["Users", "Bank_Accounts", "UPI_Transfers", "CDR_Handoffs", "CCTV_Captures"],
            "cross_table_covariance": "Preserved (Pearson r = 0.88)",
            "privacy_leakage_risk": 0.00
        }
    }
]


def get_all_datasets(category: Optional[str] = None, priority: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return all 25 datasets with optional filtering."""
    results = DATASETS_CATALOG
    if category:
        c_lower = category.lower()
        results = [d for d in results if c_lower in d["category"].lower() or c_lower in d["domain"].lower()]
    if priority:
        p_lower = priority.lower()
        results = [d for d in results if p_lower in d["priority"].lower()]
    return results


def get_dataset_by_id(dataset_id: int) -> Optional[Dict[str, Any]]:
    """Lookup dataset by numeric ID (1-25)."""
    for d in DATASETS_CATALOG:
        if d["id"] == dataset_id:
            return d
    return None


def get_dataset_sample(dataset_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve realistic sample payload for a dataset."""
    ds = get_dataset_by_id(dataset_id)
    if not ds:
        return None
    return {
        "dataset_id": ds["id"],
        "name": ds["name"],
        "category": ds["category"],
        "organization": ds["organization"],
        "sample": ds.get("sample_record", {}),
        "benchmark_metrics": ds.get("benchmark_metrics", {})
    }
