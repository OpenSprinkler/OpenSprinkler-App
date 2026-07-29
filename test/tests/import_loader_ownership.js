/* eslint-disable */

describe( "Restore loader ownership", function() {
	it( "keeps restore progress visible while every serialized mutation entry is locked", function() {
		var sandbox = sinon.createSandbox(),
			oldOwner = OSApp.uiState.operationLoaderOwner,
			oldProgramMutation = OSApp.Programs.activeMutation,
			oldProgramLoaderOwner = OSApp.Programs.mutationLoaderOwner,
			oldStationAction = OSApp.Stations.activeAction,
			oldDashboardSubmission = OSApp.Dashboard.activeStationSubmission,
			operation,
			loading;

		try {
			assert.isFalse( OSApp.ImportExport.isImportInProgress() );
			OSApp.Programs.activeMutation = null;
			OSApp.Programs.mutationLoaderOwner = null;
			OSApp.Stations.activeAction = null;
			OSApp.Dashboard.activeStationSubmission = null;
			OSApp.uiState.operationLoaderOwner = null;
			loading = sandbox.stub( $.mobile, "loading" );
			sandbox.stub( $.ajaxq, "abort" );

			operation = OSApp.ImportExport.beginOperation( OSApp.ImportExport.captureTarget() );
			assert.isObject( operation );
			assert.strictEqual( OSApp.uiState.operationLoaderOwner, operation );
			assert.isTrue( loading.calledOnceWithExactly( "show" ) );

			assert.isNull( OSApp.Programs.beginMutation(), "program mutations stay locked" );
			assert.isNull( OSApp.Stations.beginAction(), "station actions stay locked" );
			assert.isNull( OSApp.Dashboard.beginStationSubmission(), "dashboard submissions stay locked" );
			assert.isNull( OSApp.Programs.activeMutation );
			assert.isNull( OSApp.Stations.activeAction );
			assert.isNull( OSApp.Dashboard.activeStationSubmission );

			OSApp.Firmware.settleLoadingFailure( { status:0, statusText:"mutation-locked" } );
			assert.isFalse( loading.calledWith( "hide" ) );
			assert.strictEqual( OSApp.uiState.operationLoaderOwner, operation );

			assert.isTrue( OSApp.ImportExport.settleOperation( operation ) );
			assert.isTrue( loading.calledWith( "hide" ) );
			assert.isNull( OSApp.uiState.operationLoaderOwner );
		} finally {
			if ( operation && !operation.settled ) OSApp.ImportExport.settleOperation( operation );
			sandbox.restore();
			OSApp.uiState.operationLoaderOwner = oldOwner;
			OSApp.Programs.activeMutation = oldProgramMutation;
			OSApp.Programs.mutationLoaderOwner = oldProgramLoaderOwner;
			OSApp.Stations.activeAction = oldStationAction;
			OSApp.Dashboard.activeStationSubmission = oldDashboardSubmission;
		}
	} );
} );
