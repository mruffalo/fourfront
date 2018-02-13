export const WFR_JSON = {
    "@id":"/workflow-runs-awsem/4d1ba353-de87-4040-ba65-4ec8e58fe09d/",
    "awsem_app_name":"md5",
    "date_created":"2018-01-26T22:21:43.461123+00:00",
    "principals_allowed":{
        "view":[
            "award.b0b9c607-f8b4-4f02-93f4-9895b461334b",
            "group.admin",
            "group.read-only-admin",
            "lab.828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
            "remoteuser.EMBED",
            "remoteuser.INDEXER"
        ],
        "audit":[
            "system.Everyone"
        ],
        "edit":[
            "group.admin",
            "submits_for.828cd4fe-ebb0-4b36-a94a-d2e3a36cc989"
        ]
    },
    "@context":"/terms/",
    "input_files":[
        {
            "value":{
                "@id":"/files-fastq/4DNFI839XZ3K/",
                "link_id":"~files-fastq~4DNFI839XZ3K~",
                "@type":[
                    "FileFastq",
                    "File",
                    "Item"
                ],
                "file_format":"fastq",
                "filename":"H1_B2_H3K4me3_RH_334.R2.fastq.gz",
                "principals_allowed":{
                    "view":[
                        "award.4871e338-b07d-4665-a00a-357648e5bad6",
                        "group.admin",
                        "group.read-only-admin",
                        "lab.795847de-20b6-4f8c-ba8d-185215469cbf",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "audit":[
                        "system.Everyone"
                    ],
                    "edit":[
                        "group.admin",
                        "submits_for.795847de-20b6-4f8c-ba8d-185215469cbf"
                    ]
                },
                "display_title":"4DNFI839XZ3K.fastq.gz",
                "uuid":"a0b92574-bb66-4891-a59b-c371143f1b03",
                "accession":"4DNFI839XZ3K"
            },
            "ordinal":1,
            "workflow_argument_name":"input_file"
        }
    ],
    "schema_version":"1",
    "run_status":"complete",
    "uuid":"4d1ba353-de87-4040-ba65-4ec8e58fe09d",
    "steps":[
        {
            "outputs":[
                {
                    "run_data":{
                        "meta":[
                            {

                            }
                        ],
                        "file":[
                            null
                        ],
                        "type":"output"
                    },
                    "meta":{
                        "cardinality":"single",
                        "global":true,
                        "description":"The MD5 checksum generated.",
                        "type":"QC"
                    },
                    "target":[
                        {
                            "name":"report"
                        }
                    ],
                    "name":"report"
                }
            ],
            "meta":{
                "analysis_step_types":[
                    "QC calculation"
                ]
            },
            "name":"md5",
            "inputs":[
                {
                    "run_data":{
                        "meta":[
                            {
                                "ordinal":1
                            }
                        ],
                        "file":[
                            "a0b92574-bb66-4891-a59b-c371143f1b03"
                        ],
                        "type":"input"
                    },
                    "meta":{
                        "cardinality":"single",
                        "global":true,
                        "file_format":"fastq",
                        "description":"File on which MD5 calculation is run on.",
                        "type":"data file"
                    },
                    "name":"input_file",
                    "source":[
                        {
                            "name":"input_file"
                        }
                    ]
                }
            ]
        }
    ],
    "display_title":"md5 run 2018-01-26 22:21:42.109526",
    "actions":[
        {
            "profile":"/profiles/WorkflowRunAwsem.json",
            "href":"/workflow-runs-awsem/4d1ba353-de87-4040-ba65-4ec8e58fe09d/#!create",
            "name":"create",
            "title":"Create"
        },
        {
            "profile":"/profiles/WorkflowRunAwsem.json",
            "href":"/workflow-runs-awsem/4d1ba353-de87-4040-ba65-4ec8e58fe09d/#!edit",
            "name":"edit",
            "title":"Edit"
        }
    ],
    "lab":{
        "@id":"/labs/4dn-dcic-lab/",
        "principals_allowed":{
            "view":[
                "system.Everyone"
            ],
            "audit":[
                "system.Everyone"
            ],
            "edit":[
                "group.admin",
                "submits_for.828cd4fe-ebb0-4b36-a94a-d2e3a36cc989"
            ]
        },
        "display_title":"4DN DCIC Lab, HMS",
        "uuid":"828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
        "link_id":"~labs~4dn-dcic-lab~"
    },
    "audit":{

    },
    "workflow":{
        "workflow_type":"Data QC",
        "@id":"/workflows/d3f25cd3-e726-4b3c-a022-48f844474b41/",
        "title":"md5",
        "steps":[
            {
                "meta":{

                },
                "name":"md5"
            }
        ],
        "principals_allowed":{
            "view":[
                "group.admin",
                "group.read-only-admin",
                "remoteuser.EMBED",
                "remoteuser.INDEXER",
                "viewing_group.4DN"
            ],
            "audit":[
                "system.Everyone"
            ],
            "edit":[
                "group.admin"
            ]
        },
        "display_title":"md5 - 4DNWFG6JOL4D",
        "uuid":"d3f25cd3-e726-4b3c-a022-48f844474b41",
        "link_id":"~workflows~d3f25cd3-e726-4b3c-a022-48f844474b41~"
    },
    "title":"md5 run 2018-01-26 22:21:42.109526",
    "submitted_by":{
        "@id":"/users/986b362f-4eb6-4a9c-8173-3ab267307e3a/",
        "principals_allowed":{
            "view":[
                "group.admin",
                "group.read-only-admin",
                "remoteuser.EMBED",
                "remoteuser.INDEXER",
                "userid.986b362f-4eb6-4a9c-8173-3ab267307e3a"
            ],
            "audit":[
                "system.Everyone"
            ],
            "edit":[
                "group.admin",
                "userid.986b362f-4eb6-4a9c-8173-3ab267307e3a"
            ]
        },
        "display_title":"4dn DCIC",
        "uuid":"986b362f-4eb6-4a9c-8173-3ab267307e3a",
        "link_id":"~users~986b362f-4eb6-4a9c-8173-3ab267307e3a~"
    },
    "awsem_job_id":"",
    "output_files":[
        {
            "workflow_argument_name":"report",
            "type":"Output report file"
        }
    ],
    "link_id":"~workflow-runs-awsem~4d1ba353-de87-4040-ba65-4ec8e58fe09d~",
    "parameters":[

    ],
    "@type":[
        "WorkflowRunAwsem",
        "WorkflowRun",
        "Item"
    ],
    "external_references":[

    ],
    "aliases":[

    ],
    "award":{
        "@id":"/awards/1U01CA200059-01/",
        "principals_allowed":{
            "view":[
                "system.Everyone"
            ],
            "audit":[
                "system.Everyone"
            ],
            "edit":[
                "group.admin"
            ]
        },
        "display_title":"4D NUCLEOME NETWORK DATA COORDINATION AND INTEGRATION CENTER",
        "uuid":"b0b9c607-f8b4-4f02-93f4-9895b461334b",
        "link_id":"~awards~1U01CA200059-01~"
    },
    "status":"in review by lab",
    "run_platform":"AWSEM"
};